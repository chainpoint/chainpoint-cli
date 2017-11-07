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
const rp = require('request-promise-native')
const BLAKE2s = require('blake2s-js')
const uuidTime = require('uuid-time')
const OutputBuilder = require('./output-builder.js')

async function executeAsync (yargs, argv) {
  let output = new OutputBuilder('submit')
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = argv.json || false

  // determine API base URI to use
  let baseURI = argv.server

  let argCount = argv._.length

  let hashes = []
  if (argCount < 2) { // there is no hash parameter
    output.addErrorResult({
      message: `missing hash argument`
    })
    output.display(quiet, json)
  } else if (argCount === 2) { // this is one hash, or a CSV of hashes
    hashes = argv._[1].split(',')
  } else { // this is a list of multiple hashes
    hashes = argv._.splice(1)
  }

  // if there are no valid hashes submitted, abort
  if (hashes.length === 0) return

  // parameters are valid, open storage and process submit
  let nodeConfig
  let hashDb
  let hashSegments = []
  try {
    nodeConfig = await utils.getNodeConfigAsync(baseURI)
    hashDb = await storage.connectAsync()
  } catch (error) {
    for (let x = 0; x < hashes.length; x++) {
      output.addErrorResult({
        hash: hashes[x],
        message: `${error.message}`
      })
    }
    output.display(quiet, json)
    return
  }
  // The /hashes endpoint will only accept POST_HASHES_MAX hashes per request
  // if hashes contains more than POST_HASHES_MAX hashes, break the set up into multiple requests
  while (hashes.length > 0) hashSegments.push(hashes.splice(0, nodeConfig.post_hashes_max))

  let allResults = []

  for (let x = 0; x < hashSegments.length; x++) {
    let submitResults = await submitHashesAsync(nodeConfig, hashDb, hashSegments[x], baseURI)
    allResults = allResults.concat(submitResults)
  }

  for (let x = 0; x < allResults.length; x++) {
    if (allResults[x].success) {
      output.addSuccessResult({
        hash_id_node: allResults[x].hash_id_node,
        hash: allResults[x].hash,
        message: allResults[x].message
      })
    } else {
      output.addErrorResult({
        hash: allResults[x].hash,
        message: allResults[x].message
      })
    }
  }
  output.display(quiet, json)
}

async function submitHashesAsync (nodeConfig, hashDb, hashArray, baseURI) {
  let options = {
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST',
    uri: baseURI + '/hashes',
    body: { hashes: hashArray },
    json: true,
    gzip: true,
    resolveWithFullResponse: true
  }

  let submitResults = []

  let responseBody
  try {
    let response = await rp(options)
    responseBody = response.body
  } catch (error) {
    for (let x = 0; x < hashArray.length; x++) {
      submitResults.push({
        success: false,
        hash: hashArray[x],
        message: error.error.message
      })
    }
    return submitResults
  }

  for (let x = 0; x < responseBody.hashes.length; x++) {
    let hashItem = responseBody.hashes[x]
    let blakeValid = false
    try {
      // validate BLAKE2s
      let hashTimestampMS = parseInt(uuidTime.v1(hashItem.hash_id_node))
      let h = new BLAKE2s(5, { personalization: Buffer.from('CHAINPNT') })
      let hashStr = [
        hashTimestampMS.toString(),
        hashTimestampMS.toString().length,
        hashItem.hash,
        hashItem.hash.length
      ].join(':')
      h.update(Buffer.from(hashStr))
      let expectedData = Buffer.concat([Buffer.from([0x01]), h.digest()]).toString('hex')
      let embeddedData = hashItem.hash_id_node.slice(24)
      if (embeddedData === expectedData) {
        // the BLAKE2 hash has been validated
        blakeValid = true
        await hashDb.insertAsync({
          _id: hashItem.hash_id_node,
          hash: hashItem.hash,
          nodeUri: baseURI
        })
      }
      let submitResult = {}
      submitResult.success = blakeValid
      submitResult.hash_id_node = hashItem.hash_id_node
      submitResult.hash = hashItem.hash
      submitResult.message = blakeValid ? 'submitted' : 'refused, bad blake2 value in uuid from node'
      submitResults.push(submitResult)
    } catch (error) {
      let submitResult = {}
      submitResult.success = false
      submitResult.hash_id_node = hashItem.hash_id_node
      submitResult.hash = hashItem.hash
      submitResult.message = error.message
      submitResults.push(submitResult)
    }
  }

  return submitResults
}

module.exports = {
  executeAsync: executeAsync
}
