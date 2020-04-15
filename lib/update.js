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
const cpb = require('chainpoint-binary')
const OutputBuilder = require('./output-builder.js')
const parallel = require('async-await-parallel')
const chp = require('chainpoint-js')

// The time until a proof expires from storage
const PROOF_EXPIRE_MINUTES = 1440
// The maximum number of proofs that can be retrieved per request
const GET_PROOFS_MAX = 250

async function executeAsync(yargs, argv) {
  let output = new OutputBuilder('update')
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = argv.json || false

  let updateAll = argv.all
  if (!updateAll) {
    // check for valid argument value
    let proofId = argv._[1]
    let isValidHashId = utils.hashIdIsValid(proofId)
    if (!isValidHashId) {
      output.addErrorResult({
        message: `missing or invalid proof_id`
      })
      output.display(quiet, json)
      return
    }
    // parameters are valid, open storage and process update
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

      // check proof_id age for expiration
      if (utils.hashIdExpired(PROOF_EXPIRE_MINUTES, proofId)) {
        // this hash has expired
        throw new Error('expired')
      }

      let proofHandles = [{ uri: targetGatewayUri, proofId }]
      let updateResults = await updateHashesByProofIdAsync(hashDb, proofHandles)

      displayOutputResults(updateResults, output, quiet, json)
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
    try {
      hashDb = await storage.connectAsync()
      proofHandleSegments = await buildProofHandleSegments(hashDb)
    } catch (error) {
      output.addErrorResult({
        message: error.message
      })
      output.display(quiet, json)
      return
    }

    let allResults = []
    let updateTasks = []
    for (let x = 0; x < proofHandleSegments.length; x++) {
      updateTasks.push(async () => {
        return updateHashesByProofIdAsync(hashDb, proofHandleSegments[x])
      })
    }
    if (updateTasks.length > 0) {
      try {
        let updateResults = await parallel(updateTasks, 20)
        for (let x = 0; x < updateResults.length; x++) {
          allResults = allResults.concat(updateResults[x])
        }
      } catch (error) {
        console.error(`ERROR : Could not update proof data`)
      }
    }

    displayOutputResults(allResults, output, quiet, json)
  }
}

async function updateHashesByProofIdAsync(hashDb, proofHandles) {
  let updateResults = []

  let proofResponse
  try {
    proofResponse = await chp.getProofs(proofHandles)
  } catch (error) {
    for (let x = 0; x < proofHandles.length; x++) {
      updateResults.push({
        success: false,
        proof_id: proofHandles[x].proofId,
        message: `Unable to update at this time, try again: ${error.message}`
      })
    }
    return updateResults
  }

  for (let x = 0; x < proofResponse.length; x++) {
    let updateResult = {}
    let hashItem = proofResponse[x]
    if (utils.hashIdExpired(PROOF_EXPIRE_MINUTES, hashItem.proofId)) {
      updateResult.success = false
      updateResult.proof_id = hashItem.proofId
      updateResult.message = 'expired'
      updateResults.push(updateResult)
    } else if (hashItem.proof === null) {
      updateResult.success = false
      updateResult.proof_id = hashItem.proofId
      updateResult.message = 'proof data not found'
      updateResults.push(updateResult)
    } else {
      let proofObject = null
      try {
        proofObject = cpb.binaryToObjectSync(hashItem.proof)
      } catch (err) {
        updateResult.success = false
        updateResult.proof_id = hashItem.proofId
        updateResult.message = 'bad proof data'
        updateResults.push(updateResult)
        continue
      }
      let updateData = {}

      let anchorsComplete = utils.parseAnchorsComplete(proofObject)

      updateData.cal = anchorsComplete.includes('cal')
      updateData.eth = anchorsComplete.includes('eth')
      updateData.btc = anchorsComplete.includes('btc')
      updateData.proof = hashItem.proof

      try {
        await hashDb.updateAsync({ _id: hashItem.proofId }, { $set: updateData })
        let proofStates = []
        if (updateData.cal) proofStates.push('cal')
        if (updateData.eth) proofStates.push('eth')
        if (updateData.btc) proofStates.push('btc')

        updateResult.success = true
        updateResult.proof_id = hashItem.proofId
        updateResult.message = 'updated'
        updateResult.anchors_complete = proofStates
        updateResults.push(updateResult)
      } catch (error) {
        updateResult.success = false
        updateResult.proof_id = hashItem.proofId
        updateResult.message = error.message
        updateResults.push(updateResult)
      }
    }
  }

  return updateResults
}

function displayOutputResults(resultsArray, outputObj, quiet, json) {
  for (let x = 0; x < resultsArray.length; x++) {
    if (resultsArray[x].success) {
      outputObj.addSuccessResult({
        proof_id: resultsArray[x].proof_id,
        message: resultsArray[x].message,
        anchors_complete: resultsArray[x].anchors_complete
      })
    } else {
      outputObj.addErrorResult({
        proof_id: resultsArray[x].proof_id,
        message: resultsArray[x].message
      })
    }
  }
  outputObj.display(quiet, json)
}

async function buildProofHandleSegments(hashDb) {
  let proofHandleSegments = []

  let hashItems
  // retrieve proof_ids, filtering out those older than PROOF_EXPIRE_MINUTES
  let cutoffDate = new Date(new Date() - PROOF_EXPIRE_MINUTES * 60 * 1000)
  hashItems = await hashDb.findAsync({ createdAt: { $gte: cutoffDate } }, { _id: 1, gatewayUri: 1 })
  hashItems.sort(function(a, b) {
    return utils.getHashIdTime(a._id) - utils.getHashIdTime(b._id)
  })

  // Conver the array of hashItems to an array of proof handles
  // [
  //   {
  //     "uri": "a17c4ed0-8e91-11e7-a705-018c67d57227",
  //     "proofId": "http://127.0.0.1:9090"
  //   },
  //   {
  //     "uri": "e661a310-8e91-11e7-a705-012176692dbf",
  //     "proofId": "http://127.0.0.1:9090"
  //   }
  // ]
  let proofHandles = hashItems.map(hashItem => {
    return {
      uri: hashItem.gatewayUri,
      proofId: hashItem._id
    }
  })

  // Client getProofs() will only accept GET_PROOFS_MAX proofHandles per request
  // if proofHandles contains more than GET_PROOFS_MAX items, break the set up into multiple requests
  while (proofHandles.length > 0) {
    proofHandleSegments.push(proofHandles.splice(0, GET_PROOFS_MAX))
  }

  return proofHandleSegments
}

module.exports = {
  executeAsync: executeAsync,
  buildProofHandleSegments: buildProofHandleSegments,
  updateHashesByProofIdAsync: updateHashesByProofIdAsync
}
