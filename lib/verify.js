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
const parallel = require('async-await-parallel')
const chp = require('chainpoint-client')
const retry = require('async-retry')

// The time until a proof expires from storage
const PROOF_EXPIRE_MINUTES = 1440

async function executeAsync (yargs, argv) {
  let output = new OutputBuilder('verify')
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = argv.json || false

  // determine API base URI to use
  let baseURI = argv.server

  let verifyAll = argv.all
  if (!verifyAll) {
    // check for valid argument value
    let hashIdNode = argv._[1]
    let isValidHashId = utils.hashIdIsValid(hashIdNode)
    if (!isValidHashId) {
      output.addErrorResult({
        message: `missing or invalid hash_id_node`
      })
      output.display(quiet, json)
      return
    }
    // parameters are valid, open storage and process verify
    try {
      let hashDb = await storage.connectAsync()
      let hashItem = await hashDb.findOneAsync({ _id: hashIdNode }, { _id: 1, nodeUri: 1 })
      if (!hashItem) {
        throw new Error('hash_id_node not found')
      }

      let targetNodeUri = hashItem.nodeUri || null
      if (!targetNodeUri) {
        throw new Error('node_uri for hash_id_node not found')
      }

      // make sure proof hasnt expired
      if (!utils.hashIdExpired(PROOF_EXPIRE_MINUTES, hashIdNode)) {
        let proofHandles = [{ uri: targetNodeUri, hashIdNode: hashIdNode }]
        await updateCmd.updateHashesByHashIdNodeAsync(hashDb, proofHandles)
      }

      // retrieve the updated proof by hash_id_node
      hashItem = await hashDb.findOneAsync({ _id: hashIdNode })
      if (!hashItem || !hashItem.proof) throw new Error(`proof data not found`)

      let verifyResults
      try {
        verifyResults = await VerifyProofs([hashItem.proof], baseURI)
      } catch (error) {
        console.error(`ERROR : Could not verify proof`)
        return
      }

      displayOutputResults(verifyResults, output, quiet, json)
    } catch (error) {
      output.addErrorResult({
        hash_id_node: hashIdNode,
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
        updateTasks.push(async () => { return updateCmd.updateHashesByHashIdNodeAsync(hashDb, proofHandleSegments[x]) })
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

    // retrieve updated hash_id_nodes
    hashItems = await hashDb.findAsync({}, { _id: 1, proof: 1 })

    // filter out all hashes with no proof data
    hashItems = hashItems.filter((hashItem) => {
      return (hashItem.proof !== null)
    })

    // get proof array
    let proofs = hashItems.map((hashItem) => {
      return hashItem.proof
    }).filter((proof) => {
      return proof
    })

    let verifyResults
    try {
      verifyResults = await VerifyProofs(proofs, baseURI)
    } catch (error) {
      console.error(`ERROR : Could not verify proofs`)
      return
    }

    displayOutputResults(verifyResults, output, quiet, json)
  }
}

function displayOutputResults (resultsArray, outputObj, quiet, json) {
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
      hash_id_node: resultsArray[x].hash_id_node,
      message: resultsArray[x].state,
      anchors_valid: validAnchors,
      anchors_invalid: invalidAnchors
    })
  }
  outputObj.display(quiet, json)
}

async function VerifyProofs (proofs, baseURI) {
  let verifyResponse
  try {
    let firstAttempt = true
    await retry(async bail => {
      let targetURI = firstAttempt ? baseURI : null
      firstAttempt = false
      verifyResponse = await chp.verifyProofs(proofs, targetURI)
    }, {
      retries: 5,    // The maximum amount of times to retry the operation. Default is 10
      factor: 1,       // The exponential factor to use. Default is 2
      minTimeout: 50,   // The number of milliseconds before starting the first retry. Default is 1000
      maxTimeout: 50
    })
  } catch (error) {
    console.error(`Could not verify proofs : ${error.message}`)
  }

  // process chp.verifyProofs response, grouping all anchors into single hashItem object
  let hashItemAnchorGroups = verifyResponse.reduce(function (hashItemsAnchors, verifyResponseItem) {
    hashItemsAnchors[verifyResponseItem.hashIdNode] = hashItemsAnchors[verifyResponseItem.hashIdNode] || {
      hash: verifyResponseItem.hash,
      hashIdNode: verifyResponseItem.hashIdNode,
      hashIdCore: verifyResponseItem.hashIdCore,
      hashSubmittedNodeAt: verifyResponseItem.hashSubmittedNodeAt,
      hashSubmittedCoreAt: verifyResponseItem.hashSubmittedCoreAt,
      anchors: []
    }
    hashItemsAnchors[verifyResponseItem.hashIdNode].anchors.push({
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
  Object.keys(hashItemAnchorGroups).forEach((hashIdNode) => {
    let verifyResult = {}
    verifyResult.success = true
    verifyResult.hash_id_node = hashItemAnchorGroups[hashIdNode].hashIdNode
    verifyResult.hash = hashItemAnchorGroups[hashIdNode].hash

    let validAnchors = []
    let invalidAnchors = []
    let totalAnchorCount = 0
    let validAnchorCount = 0
    for (let x = 0; x < hashItemAnchorGroups[hashIdNode].anchors.length; x++) {
      totalAnchorCount++
      let anchor = hashItemAnchorGroups[hashIdNode].anchors[x]
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

module.exports = {
  executeAsync: executeAsync
}
