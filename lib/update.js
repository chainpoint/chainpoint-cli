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
const cpb = require('chainpoint-binary')
const OutputBuilder = require('./output-builder.js')
const parallel = require('async-await-parallel')

async function executeAsync (yargs, argv) {
  let output = new OutputBuilder('update')
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = argv.json || false

  let updateAll = argv.all
  if (!updateAll) {
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
    // parameters are valid, open storage and process update
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
      // check hash_id_node age for expiration
      if (utils.hashIdExpired(nodeConfig.proof_expire_minutes, hashIdNode)) { // this hash has expired
        throw new Error('expired')
      }

      let updateResults = await updateHashesByHashIdNodeAsync(nodeConfig, hashDb, [hashIdNode], targetNodeUri)

      displayOutputResults(updateResults, output, quiet, json)
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
    let nodeConfigs = {}
    try {
      hashDb = await storage.connectAsync()
      let buildResults = await buildHashIdNodeSegmentsAndConfigs(hashDb)
      hashIdNodeSegments = buildResults.hashIdNodeSegments
      nodeConfigs = buildResults.nodeConfigs
    } catch (error) {
      output.addErrorResult({
        message: error.message
      })
      output.display(quiet, json)
      return
    }

    let allResults = []
    let updateTasks = []
    for (let x = 0; x < hashIdNodeSegments.length; x++) {
      updateTasks.push(async () => { return updateHashesByHashIdNodeAsync(nodeConfigs[hashIdNodeSegments[x].nodeUri], hashDb, hashIdNodeSegments[x].hashIdNodes, hashIdNodeSegments[x].nodeUri) })
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

async function updateHashesByHashIdNodeAsync (nodeConfig, hashDb, hashIdNodeArray, baseURI) {
  let hashIdNodesCSV = hashIdNodeArray.join(',')
  let options = {
    headers: {
      'Content-Type': 'application/json',
      hashids: hashIdNodesCSV
    },
    method: 'GET',
    uri: baseURI + '/proofs',
    json: true,
    gzip: true,
    timeout: 5000,
    resolveWithFullResponse: true
  }

  let updateResults = []

  let responseBody
  try {
    let response = await rp(options)
    responseBody = response.body
  } catch (error) {
    for (let x = 0; x < hashIdNodeArray.length; x++) {
      updateResults.push({
        success: false,
        hash_id_node: hashIdNodeArray[x],
        message: error.error.message
      })
    }
    return updateResults
  }

  for (let x = 0; x < responseBody.length; x++) {
    let updateResult = {}
    let hashItem = responseBody[x]
    if (utils.hashIdExpired(nodeConfig.proof_expire_minutes, hashItem.hash_id_node)) {
      updateResult.success = false
      updateResult.hash_id_node = hashItem.hash_id_node
      updateResult.message = 'expired'
      updateResults.push(updateResult)
    } else if (hashItem.proof === null) {
      updateResult.success = false
      updateResult.hash_id_node = hashItem.hash_id_node
      updateResult.message = 'proof data not found'
      updateResults.push(updateResult)
    } else {
      let proofObject = null
      try {
        proofObject = cpb.binaryToObjectSync(hashItem.proof)
      } catch (err) {
        updateResult.success = false
        updateResult.hash_id_node = hashItem.hash_id_node
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
        await hashDb.updateAsync({ _id: hashItem.hash_id_node }, { $set: updateData })
        let proofStates = []
        if (updateData.cal) proofStates.push('cal')
        if (updateData.eth) proofStates.push('eth')
        if (updateData.btc) proofStates.push('btc')

        updateResult.success = true
        updateResult.hash_id_node = hashItem.hash_id_node
        updateResult.message = 'updated'
        updateResult.anchors_complete = proofStates
        updateResults.push(updateResult)
      } catch (error) {
        updateResult.success = false
        updateResult.hash_id_node = hashItem.hash_id_node
        updateResult.message = error.message
        updateResults.push(updateResult)
      }
    }
  }

  return updateResults
}

function displayOutputResults (resultsArray, outputObj, quiet, json) {
  for (let x = 0; x < resultsArray.length; x++) {
    if (resultsArray[x].success) {
      outputObj.addSuccessResult({
        hash_id_node: resultsArray[x].hash_id_node,
        message: resultsArray[x].message,
        anchors_complete: resultsArray[x].anchors_complete
      })
    } else {
      outputObj.addErrorResult({
        hash_id_node: resultsArray[x].hash_id_node,
        message: resultsArray[x].message
      })
    }
  }
  outputObj.display(quiet, json)
}

async function buildHashIdNodeSegmentsAndConfigs (hashDb) {
  let hashIdNodeSegments = []
  let nodeConfigs = {}

  let hashItems
  // retrieve hash_id_nodes, filtering out those older than 1 day
  let oneDayAgo = new Date(new Date() - 24 * 60 * 60 * 1000)
  hashItems = await hashDb.findAsync({ createdAt: { $gte: oneDayAgo } }, { _id: 1, nodeUri: 1 })
  hashItems.sort(function (a, b) {
    return utils.getHashIdTime(a._id) - utils.getHashIdTime(b._id)
  })
  // find all nodeUris in hashItems
  let nodeUris = _.uniqBy(hashItems, (hashItem) => {
    return hashItem.nodeUri
  }).map((hashItem) => {
    return hashItem.nodeUri
  })
  // create a dictionary of node configs for all unique nodeUris
  for (let x = 0; x < nodeUris.length; x++) {
    try {
      let nodeConfig = await utils.getNodeConfigAsync(nodeUris[x])
      nodeConfigs[nodeUris[x]] = nodeConfig
    } catch (error) {
      console.error(error.message)
    }
  }
  // filtering out hashItems older PROOF_EXPIRE_MINUTES set for each nodeUri
  hashItems = hashItems.filter((hashItem) => {
    return !utils.hashIdExpired(nodeConfigs[hashItem.nodeUri].proof_expire_minutes, hashItem._id)
  })

  // The hash_id_nodes must first be separated by nodeUri so that updates will be requested
  // separately from the Nodes they were originally submitted to.
  // create an object of nodeUri groups like the following
  // {
  //   "http://127.0.0.1:9090": [
  //     {
  //       "_id": "a17c4ed0-8e91-11e7-a705-018c67d57227",
  //       "nodeUri": "http://127.0.0.1:9090"
  //     },
  //     {
  //       "_id": "e661a310-8e91-11e7-a705-012176692dbf",
  //       "nodeUri": "http://127.0.0.1:9090"
  //     }
  //   ]
  // }
  let nodeUriGroupsObject = _.groupBy(hashItems, (hashItem) => { return hashItem.nodeUri })

  // convert that object to an array, embedding the object keys as properties in the new object array
  // [
  //   {
  //     "nodeUri": "http://127.0.0.1:9090",
  //     "hashIdNodes": [
  //       "a17c4ed0-8e91-11e7-a705-018c67d57227",
  //       "e661a310-8e91-11e7-a705-012176692dbf"
  //     ]
  //   }
  // ]
  let nodeUriGroupsArray = Object.keys(nodeUriGroupsObject).map(function (key) { return { nodeUri: key, hashIdNodes: nodeUriGroupsObject[key].map((item) => { return item._id }) } })

  for (let x = 0; x < nodeUriGroupsArray.length; x++) {
    // The /proofs endpoint will only accept GET_PROOFS_MAX_REST hash_id_nodes per request
    // if hashIdNodes contains more than GET_PROOFS_MAX_REST hash_id_nodes, break the set up into multiple requests
    while (nodeUriGroupsArray[x].hashIdNodes.length > 0) {
      hashIdNodeSegments.push({
        nodeUri: nodeUriGroupsArray[x].nodeUri,
        hashIdNodes: nodeUriGroupsArray[x].hashIdNodes.splice(0, nodeConfigs[nodeUriGroupsArray[x].nodeUri].get_proofs_max_rest)
      })
    }
  }

  return {
    hashIdNodeSegments: hashIdNodeSegments,
    nodeConfigs: nodeConfigs
  }
}

module.exports = {
  executeAsync: executeAsync,
  buildHashIdNodeSegmentsAndConfigs: buildHashIdNodeSegmentsAndConfigs,
  updateHashesByHashIdNodeAsync: updateHashesByHashIdNodeAsync
}
