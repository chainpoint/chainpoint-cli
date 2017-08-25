// load environment variables
const env = require('./parse-env.js')

const utils = require('./utils.js')
const storage = require('./storage.js')
const rp = require('request-promise-native')
const _ = require('lodash')

async function executeAsync (yargs, argv) {
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = false // temp disabled // argv.json || false

  // determine API base URI to use
  let baseURI = argv.server || env.CHAINPOINT_NODE_API_BASE_URI

  let argCount = argv._.length

  let hashes = []
  if (argCount < 2) { // there is no hash parameter
    yargs.showHelp()
    utils.log(['Submit error: Missing hash argument'], true, quiet, json)
  } else if (argCount === 2) { // this is one hash, or a CSV of hashes
    hashes = argv._[1].split(',')
  } else { // this is a list of multiple hashes
    hashes = argv._.splice(1)
  }

  // Report and remove invalid hashes from hashes array
  hashes = hashes.filter((hash) => {
    if (utils.hashIsValid(hash)) {
      return true
    } else {
      utils.log([`Submit error: Invalid hash : ${hash}`], true, quiet, json)
      return false
    }
  })

  // if there are no valid hashes submitted, abort
  if (hashes.length === 0) return

  // parameters are valid, open storage and process submit
  try {
    let stackConfig = await utils.getStackConfigAsync(baseURI)
    let hashDb = await storage.connectAsync()
    // The /hashes endpoint will only accept POST_HASHES_MAX hashes per request
    // if hashes contains more than POST_HASHES_MAX hashes, break the set up into multiple requests
    let hashSegments = []
    while (hashes.length > 0) hashSegments.push(hashes.splice(0, stackConfig.post_hashes_max))

    let allResults = []

    for (let x = 0; x < hashSegments.length; x++) {
      let submitResults = await submitHashesAsync(stackConfig, hashDb, hashSegments[x], baseURI)
      allResults = allResults.concat(submitResults)
    }
    outputSubmitResults(allResults, quiet, json)
  } catch (error) {
    utils.log([`Submit error: ${error.message}`], true, quiet, json)
  }
}

async function submitHashesAsync (stackConfig, hashDb, hashArray, baseURI) {
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

  let responseBody
  try {
    let response = await rp(options)
    responseBody = response.body
  } catch (error) {
    throw new Error(`Error submitting hashes: ${error.message}`)
  }

  let submitResults = []

  for (let x = 0; x < responseBody.hashes.length; x++) {
    let hashItem = responseBody.hashes[x]
    let row = {}
    row._id = hashItem.hash_id_node
    row.hash = hashItem.hash

    try {
      let newRow = await hashDb.insertAsync(row)
      submitResults.push(newRow)
    } catch (error) {
      throw new Error(`HashItem submit error: ${error.message}`)
    }
  }

  return submitResults
}

function outputSubmitResults (submitResults, quiet, json) {
  let items = []
  _.each(submitResults, (hashItem) => {
    items.push(`hash_id_node : ${hashItem._id}`)
  })
  utils.log(items, false, quiet, json)
}

module.exports = {
  executeAsync: executeAsync
}
