// load environment variables
const env = require('./parse-env.js')

const utils = require('./utils.js')
const storage = require('./storage.js')
const rp = require('request-promise-native')
const cpb = require('chainpoint-binary')
const OutputBuilder = require('./output-builder.js')

async function executeAsync (yargs, argv) {
  let output = new OutputBuilder('update')
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = argv.json || false

  // determine API base URI to use
  let baseURI = argv.server || env.CHAINPOINT_NODE_API_BASE_URI

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
      let stackConfig = await utils.getStackConfigAsync(baseURI)
      // check hash_id_node age for expiration
      if (utils.hashIdExpired(stackConfig.proof_expire_minutes, hashIdNode)) { // this hash has expired
        throw new Error('expired')
      }
      let hashDb = await storage.connectAsync()
      let updateResults = await updateHashesByHashIdNodeAsync(stackConfig, hashDb, [hashIdNode], baseURI)

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
    let stackConfig
    let hashDb
    let hashIdNodes
    let hashIdNodeSegments = []
    try {
      stackConfig = await utils.getStackConfigAsync(baseURI)
      hashDb = await storage.connectAsync()
      // retrieve hash_id_nodes, filtering out those older than PROOF_EXPIRE_MINUTES
      let oldestDate = new Date(new Date() - stackConfig.proof_expire_minutes * 60 * 1000)
      let hashItems = await hashDb.findAsync({ createdAt: { $gte: oldestDate } }, { _id: 1 })
      hashItems.sort(function (a, b) {
        return utils.getHashIdTime(a._id) - utils.getHashIdTime(b._id)
      })
      // get hashIdNode array
      hashIdNodes = hashItems.map((hashItem) => {
        return hashItem._id
      })
    } catch (error) {
      output.addErrorResult({
        message: error.message
      })
      output.display(quiet, json)
      return
    }

    // The /proofs endpoint will only accept GET_PROOFS_MAX_REST hash_id_nodes per request
    // if hashIdNodes contains more than GET_PROOFS_MAX_REST hash_id_nodes, break the set up into multiple requests
    while (hashIdNodes.length > 0) hashIdNodeSegments.push(hashIdNodes.splice(0, stackConfig.get_proofs_max_rest))

    let allResults = []

    for (let x = 0; x < hashIdNodeSegments.length; x++) {
      let updateResults = await updateHashesByHashIdNodeAsync(stackConfig, hashDb, hashIdNodeSegments[x], baseURI)
      allResults = allResults.concat(updateResults)
    }

    displayOutputResults(allResults, output, quiet, json)
  }
}

async function updateHashesByHashIdNodeAsync (stackConfig, hashDb, hashIdNodeArray, baseURI) {
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
    if (utils.hashIdExpired(stackConfig.proof_expire_minutes, hashItem.hash_id_node)) {
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

module.exports = {
  executeAsync: executeAsync,
  updateHashesByHashIdNodeAsync: updateHashesByHashIdNodeAsync
}
