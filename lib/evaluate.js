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

// The time until a proof expires from storage
const PROOF_EXPIRE_MINUTES = 1440

async function executeAsync(yargs, argv) {
  let output = new OutputBuilder('evaluate')
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = argv.json || false

  let evaluateAll = argv.all
  if (!evaluateAll) {
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
    // parameters are valid, open storage and process evaluate
    try {
      let hashDb = await storage.connectAsync()
      let hashItem = await hashDb.findOneAsync(
        { _id: hashIdNode },
        { _id: 1, nodeUri: 1 }
      )
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

      let evaluateResults
      try {
        evaluateResults = await EvaluateProofs([hashItem.proof])
      } catch (error) {
        console.error(`ERROR : Could not evaluate proof`)
        return
      }

      displayOutputResults(evaluateResults, output, quiet, json)
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
        updateTasks.push(async () => {
          return updateCmd.updateHashesByHashIdNodeAsync(
            hashDb,
            proofHandleSegments[x]
          )
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

    // retrieve updated hash_id_nodes
    hashItems = await hashDb.findAsync({}, { _id: 1, proof: 1 })

    // filter out all hashes with no proof data
    hashItems = hashItems.filter(hashItem => {
      return hashItem.proof !== null
    })

    // get proof array
    let proofs = hashItems
      .map(hashItem => {
        return hashItem.proof
      })
      .filter(proof => {
        return proof
      })

    let evaluateResults
    try {
      evaluateResults = await EvaluateProofs(proofs)
    } catch (error) {
      console.error(`ERROR : Could not evaluate proofs`)
      return
    }

    displayOutputResults(evaluateResults, output, quiet, json)
  }
}

function displayOutputResults(resultsArray, outputObj, quiet, json) {
  for (let x = 0; x < resultsArray.length; x++) {
    outputObj.addSuccessResult({
      hash_id_node: resultsArray[x].hash_id_node,
      type: resultsArray[x].type,
      anchor_id: resultsArray[x].anchor_id,
      expected_value: resultsArray[x].expected_value
    })
  }
  outputObj.display(quiet, json)
}

async function EvaluateProofs(proofs) {
  let evaluateResponse
  try {
    evaluateResponse = await chp.evaluateProofs(proofs)
  } catch (error) {
    console.error(`Could not evaluate proofs : ${error.message}`)
  }

  let evaluateResults = []

  // create a evaluateResult object for each evaluateResponse item
  for (let x = 0; x < evaluateResponse.length; x++) {
    let evaluateResult = {}
    evaluateResult.success = true
    evaluateResult.hash = evaluateResponse[x].hash
    evaluateResult.hash_id_node = evaluateResponse[x].hash_id_node
    evaluateResult.type = evaluateResponse[x].type
    evaluateResult.anchor_id = evaluateResponse[x].anchor_id
    evaluateResult.expected_value = evaluateResponse[x].expected_value
    evaluateResults.push(evaluateResult)
  }

  return evaluateResults
}

module.exports = {
  executeAsync: executeAsync
}
