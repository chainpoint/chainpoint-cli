// load environment variables
const env = require('./parse-env.js')

const utils = require('./utils.js')
const storage = require('./storage.js')
const rp = require('request-promise-native')
const _ = require('lodash')
const cpb = require('chainpoint-binary')

async function executeAsync (yargs, argv) {
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = false // temp disabled // argv.json || false

  // determine API base URI to use
  let baseURI = argv.server || env.CHAINPOINT_NODE_API_BASE_URI

  let updateAll = argv.all
  if (!updateAll) {
    // check for valid argument value
    let hashIdNode = argv._[1]
    let isValidHashId = utils.hashIdIsValid(hashIdNode)
    if (!isValidHashId) {
      yargs.showHelp()
      utils.log([`Update error: Missing or invalid hash_id_node`], true, quiet, json)
      return
    }
    // parameters are valid, open storage and process update
    try {
      let stackConfig = await utils.getStackConfigAsync(baseURI)
      // check hash_id_node age for expiration
      if (utils.hashIdExpired(stackConfig.proof_expire_minutes, hashIdNode)) { // this hash has expired
        throw new Error(`Expired hash_id_node: ${hashIdNode}`)
      }
      let hashDb = await storage.connectAsync()
      let updateResults = await updateHashesByHashIdNodeAsync(stackConfig, hashDb, [hashIdNode], baseURI)
      outputUpdateResults(updateResults, quiet, json)
    } catch (error) {
      utils.log([`Update error: ${error.message}`], true, quiet, json)
    }
  } else {
    // open storage and process update using hashes from local storage
    try {
      let stackConfig = await utils.getStackConfigAsync(baseURI)
      let hashDb = await storage.connectAsync()
      // retrieve hash_id_nodess, filtering out those older than PROOF_EXPIRE_MINUTES
      let oldestDate = new Date(new Date() - stackConfig.proof_expire_minutes * 60 * 1000)
      let hashItems = await hashDb.findAsync({ createdAt: { $gte: oldestDate } }, { _id: 1 })
      // get hashIdNode array
      let hashIdNodes = hashItems.map((hashItem) => {
        return hashItem._id
      })
      // filter out those older than PROOF_EXPIRE_MINUTES
      // this is a secondary check based on UUID instead of create_at record
      hashIdNodes = hashIdNodes.filter((hashIdNode) => {
        return !utils.hashIdExpired(stackConfig.proof_expire_minutes, hashIdNode)
      })
      // The /proofs endpoint will only accept GET_PROOFS_MAX_REST hash_id_nodes per request
      // if hashIdNodes contains more than GET_PROOFS_MAX_REST hash_id_nodes, break the set up into multiple requests
      let hashIdNodeSegments = []
      while (hashIdNodes.length > 0) hashIdNodeSegments.push(hashIdNodes.splice(0, stackConfig.get_proofs_max_rest))

      let allResults = []

      for (let x = 0; x < hashIdNodeSegments.length; x++) {
        let updateResults = await updateHashesByHashIdNodeAsync(stackConfig, hashDb, hashIdNodeSegments[x], baseURI)
        allResults = allResults.concat(updateResults)
      }
      outputUpdateResults(allResults, quiet, json)
    } catch (error) {
      utils.log([`Update error: ${error.message}`], true, quiet, json)
    }
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

  let responseBody
  try {
    let response = await rp(options)
    responseBody = response.body
  } catch (error) {
    throw new Error(`Error updating hashes: ${error.message}`)
  }

  let updateResults = []

  for (let x = 0; x < responseBody.length; x++) {
    let hashItem = responseBody[x]
    if (hashItem.proof === null) {
      updateResults.push({ hash_id_node: hashItem.hash_id_node, proof: null })
    } else {
      let proofObject = null
      try {
        proofObject = cpb.binaryToObjectSync(hashItem.proof)
      } catch (err) {
        updateResults.push({ hash_id_node: hashItem.hash_id_node, proof: '' })
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
        updateResults.push({ hash_id_node: hashItem.hash_id_node, proof: hashItem.proof })
      } catch (error) {
        throw new Error(`HashItem update error: ${error.message}`)
      }
    }
  }

  return updateResults
}

function outputUpdateResults (updateResults, quiet, json) {
  let items = []
  _.each(updateResults, (hashItem) => {
    switch (hashItem.proof) {
      case null:
        items.push(`Hash with hash_id_node = ${hashItem.hash_id_node} has no proof data`)
        break
      case '':
        items.push(`Could not parse proof for hash with hash_id_node  = ${hashItem.hash_id_node}`)
        break
      default:
        items.push(`Hash with hash_id_node = ${hashItem.hash_id_node} updated with latest proof data`)
    }
  })
  utils.log(items, false, quiet, json)
}

module.exports = {
  executeAsync: executeAsync,
  updateHashesByHashIdNodeAsync: updateHashesByHashIdNodeAsync
}
