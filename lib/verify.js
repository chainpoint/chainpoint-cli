// load environment variables
const env = require('./parse-env.js')

const utils = require('./utils.js')
const storage = require('./storage.js')
const rp = require('request-promise-native')
const _ = require('lodash')
const updateCmd = require('./update.js')

async function executeAsync (yargs, argv) {
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = false // temp disabled // argv.json || false

  // determine API base URI to use
  let baseURI = argv.server || env.CHAINPOINT_NODE_API_BASE_URI

  let verifyAll = argv.all
  if (!verifyAll) {
    // check for valid argument value
    let hashIdNode = argv._[1]
    let isValidHashId = utils.hashIdIsValid(hashIdNode)
    if (!isValidHashId) {
      yargs.showHelp()

      utils.log([`Verify error: Missing or invalid hash_id_node`], true, quiet, json)
      return
    }
    // parameters are valid, open storage and process verify
    try {
      let stackConfig = await utils.getStackConfigAsync(baseURI)
      let hashDb = await storage.connectAsync()
      await updateCmd.updateHashesByHashIdNodeAsync(stackConfig, hashDb, [hashIdNode], baseURI)
      // retrieve the proof by hash_id_node
      let hashItem = await hashDb.findOneAsync({ _id: hashIdNode })
      if (!hashItem || !hashItem.proof) throw new Error(`Cannot find proof for hash with hash_id_node = ${hashIdNode}`)
      // run verification on proof
      let verifyResults = await verifyProofsAsync(stackConfig, [hashItem.proof], baseURI)
      outputVerifyResults(verifyResults, quiet, json)
    } catch (error) {
      utils.log([`Verify error: ${error.message}`], true, quiet, json)
    }
  } else {
    // open storage and process update using hashes from local storage
    try {
      let stackConfig = await utils.getStackConfigAsync(baseURI)
      let hashDb = await storage.connectAsync()
      // retrieve hash_id_nodes
      let hashItems = await hashDb.findAsync({}, { _id: 1 })
      // get hashIdNode array
      let hashIdNodes = hashItems.map((hashItem) => {
        return hashItem._id
      })
      // The /proofs endpoint will only accept GET_PROOFS_MAX_REST hash_id_nodes per request
      // if hashIdNodes contains more than GET_PROOFS_MAX_REST hash_id_nodes, break the set up into multiple requests
      let hashIdNodeSegments = []
      while (hashIdNodes.length > 0) hashIdNodeSegments.push(hashIdNodes.splice(0, stackConfig.get_proofs_max_rest))
      for (let x = 0; x < hashIdNodeSegments.length; x++) {
        await updateCmd.updateHashesByHashIdNodeAsync(stackConfig, hashDb, hashIdNodeSegments[x], baseURI)
      }
      // retrieve hash_id_nodes
      hashItems = await hashDb.findAsync({}, { _id: 1, proof: 1 })
      // filter out all hashes with no proof data
      hashItems = hashItems.filter((hashItem) => {
        if (hashItem.proof == null) {
          utils.log([`Proof for hash with hash_id_node = ${hashItem._id} is not yet available`], false, quiet, json)
          return false
        }
        return true
      })
      // get proof array
      let proofs = hashItems.map((hashItem) => {
        return hashItem.proof
      })
      // The /verify endpoint will only accept POST_VERIFY_PROOFS_MAX proofs per request
      // if proofs contains more than POST_VERIFY_PROOFS_MAX proofs, break the set up into multiple requests
      let proofSegments = []
      while (proofs.length > 0) proofSegments.push(proofs.splice(0, stackConfig.post_verify_proofs_max))

      let allResults = []
      for (let x = 0; x < proofSegments.length; x++) {
        // verify proofs
        let verifyResults = await verifyProofsAsync(stackConfig, proofSegments[x], baseURI)
        allResults = allResults.concat(verifyResults)
      }
      outputVerifyResults(allResults, quiet, json)
    } catch (error) {
      utils.log([`Verify error: ${error.message}`], true, quiet, json)
    }
  }
}

async function verifyProofsAsync (stackConfig, proofArray, baseURI) {
  let options = {
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST',
    uri: baseURI + '/verify',
    body: { proofs: proofArray },
    json: true,
    gzip: true,
    resolveWithFullResponse: true
  }

  let responseBody
  try {
    let response = await rp(options)
    responseBody = response.body
  } catch (error) {
    throw new Error(`Error verifying proofs: ${error.message}`)
  }

  return responseBody
}

function outputVerifyResults (verifyResults, quiet, json) {
  let items = []
  _.each(verifyResults, (proof) => {
    let proofAnchors = []
    for (let x = 0; x < proof.anchors.length; x++) {
      if (proof.anchors[x].valid) {
        proofAnchors.push(proof.anchors[x].type)
      } else {
        proofAnchors.push(`!${proof.anchors[x].type}!`)
      }
    }
    let proofAnchorsString = proofAnchors.join(', ')
    items.push(`${proof.hash_id_node} | ${proof.status} | ${proofAnchorsString}`)
  })
  utils.log(items, false, quiet, json)
}

module.exports = {
  executeAsync: executeAsync
}
