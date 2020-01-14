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
const TX = require('bcoin/lib/primitives/tx')

// The time until a proof expires from storage
const PROOF_EXPIRE_MINUTES = 1440

async function executeAsync(yargs, argv) {
  let output = new OutputBuilder('evaluate')
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = argv.json || false
  // parse btc tx information if set
  let btc = argv.btc || false
  let evaluateAll = argv.all
  if (!evaluateAll) {
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
    // parameters are valid, open storage and process evaluate
    try {
      let hashDb = await storage.connectAsync()
      let hashItem = await hashDb.findOneAsync({ _id: proofId }, { _id: 1, nodeUri: 1 })
      if (!hashItem) {
        throw new Error('proof_id not found')
      }

      let targetNodeUri = hashItem.nodeUri || null
      if (!targetNodeUri) {
        throw new Error('node_uri for proof_id not found')
      }

      // make sure proof hasnt expired
      if (!utils.hashIdExpired(PROOF_EXPIRE_MINUTES, proofId)) {
        let proofHandles = [{ uri: targetNodeUri, proof_id: proofId }]
        await updateCmd.updateHashesByproofIdAsync(hashDb, proofHandles)
      }

      // retrieve the updated proof by proof_id
      hashItem = await hashDb.findOneAsync({ _id: proofId })
      if (!hashItem || !hashItem.proof) throw new Error(`proof data not found`)

      let evaluateResults
      try {
        evaluateResults = await EvaluateProofs([hashItem.proof], btc)
      } catch (error) {
        console.error(`ERROR : Could not evaluate proof`)
        return
      }

      displayOutputResults(evaluateResults, output, quiet, json, btc)
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
          return updateCmd.updateHashesByproofIdAsync(hashDb, proofHandleSegments[x])
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
      evaluateResults = await EvaluateProofs(proofs, btc)
    } catch (error) {
      console.error(`ERROR : Could not evaluate proofs`)
      return
    }

    displayOutputResults(evaluateResults, output, quiet, json, btc)
  }
}

function displayOutputResults(resultsArray, outputObj, quiet, json, btc) {
  for (let result of resultsArray) {
    let tx, output
    output = {
      proof_id: result.proof_id,
      type: result.type,
      anchor_id: result.anchor_id,
      expected_value: result.expected_value
    }
    if (btc && result.raw_btc_tx) {
      tx = TX.fromRaw(result.raw_btc_tx, 'hex')
      output.txid = tx.txid()
    }
    outputObj.addSuccessResult(output)
  }
  outputObj.display(quiet, json)
}

async function EvaluateProofs(proofs, btc) {
  let evaluateResponse = []
  try {
    for (let proof of proofs) {
      let response
      response = await chp.evaluateProofs([proof])
      // add btc rawTx to applicable response
      if (btc) {
        // only expect 1 btcResponse, so it will be first item in response array
        const [btcResponse] = await chp.getProofTxs([proof])
        // btc anchored hashes have multiple responses
        // so we need to find the right one to add tx information to
        let index = response.findIndex(
          anchor =>
            // find anchor response where type is btc and confirm id matches
            anchor.type === 'btc' && anchor.proof_id === btcResponse.proof_id
        )
        // add btcResponse info to anchor response
        response[index] = { ...btcResponse, ...response[index] }
      }
      evaluateResponse.push(...response)
    }
  } catch (error) {
    console.error(`Could not evaluate proofs : ${error.message}`)
  }

  let evaluateResults = []

  // create a evaluateResult object for each evaluateResponse item
  for (let x = 0; x < evaluateResponse.length; x++) {
    let evaluateResult = {}
    evaluateResult.success = true
    evaluateResult.hash = evaluateResponse[x].hash
    evaluateResult.proof_id = evaluateResponse[x].proof_id
    evaluateResult.type = evaluateResponse[x].type
    evaluateResult.anchor_id = evaluateResponse[x].anchor_id
    evaluateResult.expected_value = evaluateResponse[x].expected_value
    if (btc) evaluateResult.raw_btc_tx = evaluateResponse[x].raw_btc_tx
    evaluateResults.push(evaluateResult)
  }

  return evaluateResults
}

module.exports = {
  executeAsync: executeAsync
}
