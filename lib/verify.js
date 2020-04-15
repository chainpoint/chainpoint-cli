/* Copyright 2017 Tierion
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const utils = require('./utils.js')
const storage = require('./storage.js')
const updateCmd = require('./update.js')
const OutputBuilder = require('./output-builder.js')
const chalk = require('chalk')
const parallel = require('async-await-parallel')
const chp = require('chainpoint-js')
const retry = require('async-retry')
const { mapKeys, camelCase, forEach } = require('lodash')

const { getClient, testConnection } = require('./bhn/utils')

// The time until a proof expires from storage
const PROOF_EXPIRE_MINUTES = 1440

async function executeAsync(yargs, argv) {
  let output = new OutputBuilder('verify')
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = argv.json || false

  let verifyAll = argv.all
  if (!verifyAll) {
    // check for valid argument value
    let proofId = argv._[1]
    let isValidProofId = utils.proofIdIsValid(proofId)
    if (!isValidProofId) {
      output.addErrorResult({
        message: `missing or invalid proof_id`
      })
      output.display(quiet, json)
      return
    }
    // parameters are valid, open storage and process verify
    try {
      let hashDb = await storage.connectAsync()
      let hashItem = await hashDb.findOneAsync({ _id: proofId }, { _id: 1, gatewayUri: 1 })
      if (!hashItem) {
        throw new Error('proof_id not found')
      }

      let targetGatewayUri = hashItem.gatewayUri || null
      if (!targetGatewayUri) {
        throw new Error('gateway_uri for proof_id not found')
      }

      // make sure proof hasnt expired
      if (!utils.proofIdExpired(PROOF_EXPIRE_MINUTES, proofId)) {
        let proofHandles = [{ uri: targetGatewayUri, proofId }]
        await updateCmd.updateHashesByProofIdAsync(hashDb, proofHandles)
      }

      // retrieve the updated proof by proof_id
      hashItem = await hashDb.findOneAsync({ _id: proofId })
      if (!hashItem || !hashItem.proof) throw new Error(`proof data not found`)

      let verifyResults
      try {
        verifyResults = await VerifyProofs(
          [
            {
              proof: hashItem.proof,
              gatewayUri: targetGatewayUri
            }
          ],
          argv
        )
      } catch (error) {
        console.error(`ERROR : Could not verify proof`)
        return
      }

      displayOutputResults(verifyResults, output, quiet, json)
    } catch (error) {
      output.addErrorResult({
        proof_id: proofId,
        message: error.message
      })
      output.display(quiet, json)
    }
  } else {
    // open storage and process update using hashes from local storage
    let hashDb
    let proofHandleSegments = []
    let hashItems
    try {
      hashDb = await storage.connectAsync()
      proofHandleSegments = await updateCmd.buildProofHandleSegments(hashDb)

      let updateTasks = []
      for (let x = 0; x < proofHandleSegments.length; x++) {
        updateTasks.push(async () => {
          return updateCmd.updateHashesByProofIdAsync(hashDb, proofHandleSegments[x])
        })
      }
      if (updateTasks.length > 0) {
        try {
          await parallel(updateTasks, 20)
        } catch (error) {
          console.error(`ERROR : Could not update proof data`)
        }
      }
    } catch (error) {
      output.addErrorResult({
        message: error.message
      })
      output.display(quiet, json)
      return
    }

    // retrieve updated proof_ids
    hashItems = await hashDb.findAsync({}, { proof: 1, gatewayUri: 1 })

    // filter out all hashes with no proof data
    hashItems = hashItems.filter(hashItem => {
      return hashItem.proof
    })

    // get proof array
    let proofData = hashItems.map(hashItem => {
      return { proof: hashItem.proof, gatewayUri: hashItem.gatewayUri }
    })

    let verifyResults
    try {
      verifyResults = await VerifyProofs(proofData, argv)
    } catch (error) {
      console.error(`ERROR: Could not verify proofs. ${error.message}`)
      return
    }

    displayOutputResults(verifyResults, output, quiet, json)
  }
}

function displayOutputResults(resultsArray, outputObj, quiet, json) {
  for (let x = 0; x < resultsArray.length; x++) {
    let validAnchors = []
    for (let y = 0; y < resultsArray[x].anchors_valid.length; y++) {
      validAnchors.push(resultsArray[x].anchors_valid[y].type)
    }
    let invalidAnchors = []

    for (let y = 0; y < resultsArray[x].anchors_invalid.length; y++) {
      let result
      if (resultsArray[x].anchors_invalid[y].status === 'unknown') {
        result = `?${resultsArray[x].anchors_invalid[y].type}?`
      } else {
        result = `!${resultsArray[x].anchors_invalid[y].type}!`
      }
      invalidAnchors.push(result)
    }

    outputObj.addSuccessResult({
      proof_id: resultsArray[x].proof_id,
      message: resultsArray[x].state,
      anchors_valid: validAnchors,
      anchors_invalid: invalidAnchors
    })
  }
  outputObj.display(quiet, json)
}

async function VerifyProofs(proofData, options) {
  let verifyResponse
  try {
    // first test a connection to a bhn node based on passed in options
    let hasBhnConnection = await testConnection(options, true)

    // Create a lookup table of proofs grouped by their common gatewayUri
    // These groups will be verified in separate calls if no bhn available
    // because the chp.verifyProofs command accepts one URI for a group of proofs.
    let proofDataURIGroups = proofData.reduce((results, proofDataItem) => {
      if (results[proofDataItem.gatewayUri] === undefined) {
        results[proofDataItem.gatewayUri] = [proofDataItem.proof]
      } else {
        results[proofDataItem.gatewayUri].push(proofDataItem.proof)
      }
      return results
    }, {})

    // initialize array of async tasks and setup client
    let verifyTasks = []
    let btcClient, network
    if (hasBhnConnection) {
      btcClient = getClient(options)
      let info = await btcClient.getInfo()
      network = info.network
      if (network === 'main') network = 'mainnet'
      let uri = `${btcClient.ssl ? 'https:' : 'http:'}//${btcClient.host}:${btcClient.port}`
      console.log(`Verifying btc proofs against ${network} bitcoin node at ${uri}...`)
    } else {
      console.log(`Could not connect to bitcoin node. Verifying proofs against a Chainpoint Gateway.`)
    }

    // next we need to create the async validation tasks
    // there will be two loops to accomplish this
    // first go through each gatewayURI's array of proofs and for those proofs,
    // if we have a bitcoin node connection, we need to determine if each proof
    // has a btc anchor by looping through each proof, evaluating/parsing, and then
    // if it does, verify against the bitcoin node. Otherwise, add a chp node verification task
    for (var gatewayUri in proofDataURIGroups) {
      // if we don't have access to a bitcoin node (`!hasBhnConnection`)
      if (!hasBhnConnection && proofDataURIGroups.hasOwnProperty(gatewayUri)) {
        // simply add a new verify async task for the group for each gateway_uri
        let proofs = [...proofDataURIGroups[gatewayUri]]
        let task = verifySetAsync({
          proofs,
          gatewayUri: gatewayUri
        })
        // adding a catch to each task so that in the event that one fails,
        // it doesn't crash the entire `Promise.all` resolution
        verifyTasks.push(task.catch(() => catchFailedVerification(proofs)))
      } else {
        // otherwise we need to determine if there is a btc anchor to verify
        forEach(proofDataURIGroups[gatewayUri], rawProof => {
          let task
          // evaluate/parse each proof with chainpoint-js
          let proofs = chp.evaluateProofs([rawProof])
          // if proof has btc type proof
          let btcAnchorIndex
          if (network === 'main') btcAnchorIndex = proofs.findIndex(proof => proof.type === 'btc')
          else btcAnchorIndex = proofs.findIndex(proof => proof.type === 'tbtc')

          // add new task to verify against bitcoin node
          if (btcAnchorIndex > -1) {
            task = verifyBtcProof(proofs[btcAnchorIndex], btcClient)
            verifyTasks.push(task.catch(() => catchFailedVerification([rawProof])))
          } else {
            // otherwise add verifySetAsync task for that (raw) proof
            task = verifySetAsync({
              proofs: [rawProof],
              gatewayUri: gatewayUri
            })
            verifyTasks.push(task.catch(() => catchFailedVerification([rawProof])))
          }
        })
      }
    }

    // execute and await thew results of all verify tasks
    let verifyTasksResults = await Promise.all(verifyTasks)

    // combine all verify results into a single verify results array
    verifyResponse = verifyTasksResults.reduce((results, response) => {
      if (!response) return results
      if (Array.isArray(response)) results.push(...response)
      else results.push(response)
      return results
    }, [])
  } catch (error) {
    console.error(`Could not verify proofs: ${error.message}`)
  }

  // process chp.verifyProofs response, grouping all anchors into single hashItem object
  let hashItemAnchorGroups = verifyResponse.reduce(function(hashItemsAnchors, verifyResponseItem) {
    hashItemsAnchors[verifyResponseItem.proofId] = hashItemsAnchors[verifyResponseItem.proofId] || {
      hash: verifyResponseItem.hash,
      proofId: verifyResponseItem.proofId,
      hashReceived: verifyResponseItem.hashReceived,
      anchors: []
    }
    hashItemsAnchors[verifyResponseItem.proofId].anchors.push({
      branch: verifyResponseItem.branch,
      uri: verifyResponseItem.uri,
      type: verifyResponseItem.type,
      anchorId: verifyResponseItem.anchorId,
      expectedValue: verifyResponseItem.expectedValue,
      verified: verifyResponseItem.verified,
      verifiedAt: verifyResponseItem.verifiedAt
    })
    return hashItemsAnchors
  }, {})

  let verifyResults = []

  // create a verifyResult object for each hashItemAnchorGroups item
  Object.keys(hashItemAnchorGroups).forEach(proofId => {
    let verifyResult = {}
    verifyResult.success = true
    verifyResult.proof_id = hashItemAnchorGroups[proofId].proofId
    verifyResult.hash = hashItemAnchorGroups[proofId].hash

    let validAnchors = []
    let invalidAnchors = []
    let totalAnchorCount = 0
    let validAnchorCount = 0
    for (let x = 0; x < hashItemAnchorGroups[proofId].anchors.length; x++) {
      totalAnchorCount++
      let anchor = hashItemAnchorGroups[proofId].anchors[x]
      if (anchor.verified) {
        validAnchorCount++
        validAnchors.push({
          type: anchor.type,
          status: true
        })
      } else {
        invalidAnchors.push({
          type: anchor.type,
          status: false
        })
      }
    }
    verifyResult.anchors_valid = validAnchors
    verifyResult.anchors_invalid = invalidAnchors
    let state
    if (validAnchorCount === 0) {
      state = 'invalid'
    } else if (validAnchorCount === totalAnchorCount) {
      state = 'verified'
    } else {
      state = 'mixed'
    }

    verifyResult.state = state
    verifyResults.push(verifyResult)
  })

  return verifyResults
}

// define a function for verifying a set of proofs sharing a common gatewayUri
async function verifySetAsync(proofDataSet) {
  return retry(
    async () => {
      let targetURI = proofDataSet.gatewayUri
      return chp.verifyProofs(proofDataSet.proofs, targetURI)
    },
    {
      retries: 2, // The maximum amount of times to retry the operation. Default is 10
      factor: 1, // The exponential factor to use. Default is 2
      minTimeout: 10, // The number of milliseconds before starting the first retry. Default is 1000
      maxTimeout: 10
    }
  )
}

async function verifyBtcProof(proof, client) {
  try {
    // get header from bitcoin node
    let header = await client.getBlock(parseInt(proof.anchor_id, 10))

    // check if there was a header returned and it matches the expected value in the proof
    let verified = header && header.merkleRoot === proof.expected_value
    if (!verified) {
      // want to see if the reason for verification fail is because of a network mismatch b/w
      // anchor and bhn we are in communication with
      let { network } = await client.getInfo()
      let anchorNetwork

      if (proof.type === 'tbtc') anchorNetwork = 'testnet'
      else if (proof.type === 'btc') anchorNetwork = 'main'
      else throw new Error(`Unknown anchor type ${proof.type}`)

      if (network !== anchorNetwork)
        console.log(
          chalk`{red NETWORK MISMATCH:} ${proof.proof_id} anchored to bitcoin's ${anchorNetwork} network at height ${
            proof.anchor_id
          }, but validating node is running on ${network}`
        )
    }
    let verifiedProof = { ...proof, verified }

    // add verification time stamp
    verifiedProof.verified_at = verified ? new Date().toISOString().slice(0, 19) + 'Z' : null
    return mapKeys(verifiedProof, (v, k) => camelCase(k))
  } catch (err) {
    console.error(`Problem validating proof with bitcoin node: ${err.message}`)
  }
}

function catchFailedVerification(proofs) {
  if (!Array.isArray(proofs)) proofs = [proofs]
  proofs = chp.evaluateProofs(proofs)
  return proofs.map(proof => {
    proof.verified = null
    proof.verified_at = null
    return mapKeys(proof, (v, k) => camelCase(k))
  })
}

module.exports = {
  executeAsync: executeAsync
}
