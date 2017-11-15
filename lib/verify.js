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

const _ = require('lodash')
const utils = require('./utils.js')
const storage = require('./storage.js')
const rp = require('request-promise-native')
const updateCmd = require('./update.js')
const OutputBuilder = require('./output-builder.js')
const parallel = require('async-await-parallel')
const chpParse = require('chainpoint-parse')

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

      let nodeConfig = await utils.getNodeConfigAsync(targetNodeUri)
      // make sure proof hasnt expired
      if (!utils.hashIdExpired(nodeConfig.proof_expire_minutes, hashIdNode)) {
        await updateCmd.updateHashesByHashIdNodeAsync(nodeConfig, hashDb, [hashIdNode], targetNodeUri)
      }

      // retrieve the updated proof by hash_id_node
      hashItem = await hashDb.findOneAsync({ _id: hashIdNode })
      if (!hashItem || !hashItem.proof) throw new Error(`proof data not found`)

      let verifyTasks = BuildVerifyTaskList([hashItem.proof])
      let verifyResults
      try {
        verifyResults = await ProcessVerifyTasksAsync(verifyTasks, baseURI)
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
    let hashIdNodeSegments = []
    let hashItems
    let nodeConfigs = {}
    try {
      hashDb = await storage.connectAsync()
      let buildResults = await updateCmd.buildHashIdNodeSegmentsAndConfigs(hashDb)
      hashIdNodeSegments = buildResults.hashIdNodeSegments
      nodeConfigs = buildResults.nodeConfigs

      let updateTasks = []
      for (let x = 0; x < hashIdNodeSegments.length; x++) {
        updateTasks.push(async () => { return updateCmd.updateHashesByHashIdNodeAsync(nodeConfigs[hashIdNodeSegments[x].nodeUri], hashDb, hashIdNodeSegments[x].hashIdNodes, hashIdNodeSegments[x].nodeUri) })
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

    let verifyTasks = BuildVerifyTaskList(proofs)
    let verifyResults
    try {
      verifyResults = await ProcessVerifyTasksAsync(verifyTasks, baseURI)
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

/**
 * Verify utility functions to be relocated to client library
 */

function BuildVerifyTaskList (proofs) {
  let results = []
  let proofIndex = 0

  // extract id, time, anchors, and calculate expected values
  for (let x = 0; x < proofs.length; x++) {
    let parseObj = null
    let proof = proofs[x]
    if (typeof (proof) === 'string') { // then this should be a binary proof
      try {
        parseObj = chpParse.parseBinarySync(proof)
        results.push(buildResultObject(parseObj, proofIndex++))
      } catch (error) {

      }
    } else if (typeof (proof) === 'object') { // then this should be a JSON proof
      try {
        parseObj = chpParse.parseObjectSync(proof)
        results.push(buildResultObject(parseObj, proofIndex++))
      } catch (error) {

      }
    }
  }

  return results
}

function buildResultObject (parseObj, proofIndex) {
  let hashIdNode = parseObj !== null ? parseObj.hash_id_node : undefined
  let hash = parseObj !== null ? parseObj.hash : undefined
  let expectedValues = parseObj !== null ? flattenExpectedValues(parseObj.branches) : undefined

  return {
    hash_id_node: hashIdNode,
    hash: hash,
    anchors: expectedValues
  }
}

function flattenExpectedValues (branchArray) {
  let results = []
  for (let b = 0; b < branchArray.length; b++) {
    let anchors = branchArray[b].anchors
    if (anchors.length > 0) {
      for (let a = 0; a < anchors.length; a++) {
        results.push({
          branch: branchArray[b].label || undefined,
          anchor: anchors[a]
        })
      }
    }
    if (branchArray[b].branches) {
      results = results.concat(flattenExpectedValues(branchArray[b].branches))
    }
    return results
  }
}

async function ProcessVerifyTasksAsync (verifyTasks, baseURI) {
  // get a list of all unique anchor objects for all the proofs in verifyTasks
  // we do this to prevent asking for the same anchor data from Node twice
  let allAnchors = []
  if (verifyTasks.length > 0) {
    allAnchors = verifyTasks.map((verifyTask) => {
      return verifyTask.anchors
    }).reduce((anchors, anchorPerProof) => {
      return anchors.concat(anchorPerProof)
    }).map((anchorItem) => {
      return anchorItem.anchor
    })
  }
  let uniqueAnchorList = _.uniqWith(allAnchors, _.isEqual)

  // create a unique anchors object accessible by [type-id], e.g. ['cal-560303']
  let uniqueAnchors = {}
  for (let x = 0; x < uniqueAnchorList.length; x++) {
    uniqueAnchors[`${uniqueAnchorList[x].type}-${uniqueAnchorList[x].anchor_id}`] = uniqueAnchorList[x]
  }

  // get confirmation results for each unique anchor
  let confirmTasks = []
  for (let x = 0; x < uniqueAnchorList.length; x++) {
    confirmTasks.push(async () => { return confirmExpectedValueAsync(uniqueAnchorList[x], baseURI) })
  }
  let confirmResults = []
  if (confirmTasks.length > 0) {
    confirmResults = await parallel(confirmTasks, 20)
  }
  // assign those confirmation results to their corresponding unique anchor object
  for (let x = 0; x < uniqueAnchorList.length; x++) {
    uniqueAnchors[`${uniqueAnchorList[x].type}-${uniqueAnchorList[x].anchor_id}`].is_valid = confirmResults[x]
  }

  let verifyResults = []
  for (let x = 0; x < verifyTasks.length; x++) {
    let verifyTask = verifyTasks[x]

    let verifyResult = {}
    verifyResult.success = true
    verifyResult.hash_id_node = verifyTask.hash_id_node
    verifyResult.hash = verifyTask.hash

    let validAnchors = []
    let invalidAnchors = []
    let totalAnchorCount = 0
    let validAnchorCount = 0
    for (let x = 0; x < verifyTask.anchors.length; x++) {
      totalAnchorCount++
      let anchor = verifyTask.anchors[x]
      let anchorKey = `${anchor.anchor.type}-${anchor.anchor.anchor_id}`
      let isValid = uniqueAnchors[anchorKey].is_valid
      if (isValid === 'valid') {
        validAnchorCount++
        validAnchors.push({
          type: anchor.anchor.type,
          status: isValid
        })
      } else {
        invalidAnchors.push({
          type: anchor.anchor.type,
          status: isValid
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
  }

  return verifyResults
}

async function confirmExpectedValueAsync (anchorInfo, baseURI) {
  let anchorType = anchorInfo.type
  let anchorId = anchorInfo.anchor_id
  let anchorUri = anchorInfo.uris[0]
  let expectedValue = anchorInfo.expected_value

  switch (anchorType) {
    case 'cal':
      try {
        // check the Node calendar for the block
        let options = {
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'GET',
          uri: `${baseURI}/calendar/${anchorId}/hash`,
          json: true,
          gzip: true,
          resolveWithFullResponse: true
        }

        let response = await rp(options)
        let blockHash = response.body
        return (blockHash === expectedValue) ? 'valid' : 'invalid'
      } catch (error) {
        return 'unknown'
      }
    case 'btc':
      try {
        // check the Core calendar for the block in case the Node calendar does not have the latest blocks
        let path = _.takeRight(anchorUri.split('/'), 3).join('/')
        let options = {
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'GET',
          uri: `${baseURI}/${path}`,
          json: true,
          gzip: true,
          resolveWithFullResponse: true
        }

        let response = await rp(options)
        let blockDataVal = response.body
        let blockRoot = blockDataVal.match(/.{2}/g).reverse().join('')
        return (blockRoot === expectedValue) ? 'valid' : 'invalid'
      } catch (error) {
        return 'unknown'
      }
    case 'eth':
      break
  }
}

module.exports = {
  executeAsync: executeAsync
}
