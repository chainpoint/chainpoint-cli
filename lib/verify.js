// load environment variables
const env = require('./parse-env.js')

const utils = require('./utils.js')
const storage = require('./storage.js')
const rp = require('request-promise-native')
const updateCmd = require('./update.js')
const OutputBuilder = require('./output-builder.js')

async function executeAsync (yargs, argv) {
  let output = new OutputBuilder('verify')
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = argv.json || false

  // determine API base URI to use
  let baseURI = argv.server || env.CHAINPOINT_NODE_API_BASE_URI

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
      let stackConfig = await utils.getStackConfigAsync(baseURI)
      let hashDb = await storage.connectAsync()
      await updateCmd.updateHashesByHashIdNodeAsync(stackConfig, hashDb, [hashIdNode], baseURI)
      // retrieve the proof by hash_id_node
      let hashItem = await hashDb.findOneAsync({ _id: hashIdNode })
      if (!hashItem || !hashItem.proof) throw new Error(`proof data not found`)
      // run verification on proof
      let verifyResults = await verifyProofsAsync(stackConfig, [hashItem], baseURI)

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
    let stackConfig
    let hashDb
    let hashIdNodes
    let hashIdNodeSegments = []
    let hashItems
    try {
      stackConfig = await utils.getStackConfigAsync(baseURI)
      hashDb = await storage.connectAsync()
      // retrieve hash_id_nodes
      hashItems = await hashDb.findAsync({}, { _id: 1 })
      hashItems.sort(function (a, b) {
        return utils.getHashIdTime(a._id) - utils.getHashIdTime(b._id)
      })
      // get hashIdNode array
      hashIdNodes = hashItems.map((hashItem) => {
        return hashItem._id
      })

      // The /proofs endpoint will only accept GET_PROOFS_MAX_REST hash_id_nodes per request
      // if hashIdNodes contains more than GET_PROOFS_MAX_REST hash_id_nodes, break the set up into multiple requests
      while (hashIdNodes.length > 0) hashIdNodeSegments.push(hashIdNodes.splice(0, stackConfig.get_proofs_max_rest))

      for (let x = 0; x < hashIdNodeSegments.length; x++) {
        await updateCmd.updateHashesByHashIdNodeAsync(stackConfig, hashDb, hashIdNodeSegments[x], baseURI)
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

    // The /verify endpoint will only accept POST_VERIFY_PROOFS_MAX proofs per request
    // if proofItems contains more than POST_VERIFY_PROOFS_MAX proofs, break the set up into multiple requests
    let proofSegments = []
    while (hashItems.length > 0) proofSegments.push(hashItems.splice(0, stackConfig.post_verify_proofs_max))

    let allResults = []
    for (let x = 0; x < proofSegments.length; x++) {
      // verify proofs
      let verifyResults = await verifyProofsAsync(stackConfig, proofSegments[x], baseURI)
      allResults = allResults.concat(verifyResults)
    }

    displayOutputResults(allResults, output, quiet, json)
  }
}

async function verifyProofsAsync (stackConfig, hashItems, baseURI) {
  // get proof array
  let proofs = hashItems.map((hashItem) => {
    return hashItem.proof
  })

  let options = {
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST',
    uri: baseURI + '/verify',
    body: { proofs: proofs },
    json: true,
    gzip: true,
    resolveWithFullResponse: true
  }

  let verifyResults = []

  let responseBody
  try {
    let response = await rp(options)
    responseBody = response.body
  } catch (error) {
    for (let x = 0; x < hashItems.length; x++) {
      verifyResults.push({
        success: false,
        hash_id_node: hashItems[x]._id,
        message: error.error.message
      })
    }
    return verifyResults
  }

  for (let x = 0; x < responseBody.length; x++) {
    let verifyResult = {}
    let proofInfo = responseBody[x]

    verifyResult.success = true
    verifyResult.hash_id_node = proofInfo.hash_id_node
    verifyResult.message = proofInfo.status
    let validAnchors = []
    let invalidAnchors = []
    for (let x = 0; x < proofInfo.anchors.length; x++) {
      if (proofInfo.anchors[x].valid) {
        validAnchors.push(proofInfo.anchors[x].type)
      } else {
        invalidAnchors.push(`!${proofInfo.anchors[x].type}!`)
      }
    }
    verifyResult.anchors_valid = validAnchors
    verifyResult.anchors_invalid = invalidAnchors
    verifyResults.push(verifyResult)
  }

  return verifyResults
}

function displayOutputResults (resultsArray, outputObj, quiet, json) {
  for (let x = 0; x < resultsArray.length; x++) {
    if (resultsArray[x].success) {
      outputObj.addSuccessResult({
        hash_id_node: resultsArray[x].hash_id_node,
        message: resultsArray[x].message,
        anchors_valid: resultsArray[x].anchors_valid,
        anchors_invalid: resultsArray[x].anchors_invalid
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
  executeAsync: executeAsync
}
