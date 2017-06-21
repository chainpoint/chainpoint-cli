// load environment variables
const env = require('./parse-env.js')

const utils = require('./utils.js')
const storage = require('./storage.js')
const request = require('request')
const async = require('async')
const _ = require('lodash')

function execute (yargs, argv) {
  // determine API base URI to use
  let baseURI = argv.server || env.CHAINPOINT_API_BASE_URI

  let argCount = argv._.length

  let hashes = []
  if (argCount < 2) { // there is no hash parameter
    yargs.showHelp()
    console.log('Submit error: Missing hash argument')
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
      console.log(`Submit error: Invalid hash : ${hash}`)
      return false
    }
  })

  // if there are no valid hashes submitted, abort
  if (hashes.length === 0) return

  // parameters are valid, open storage and process submit
  async.waterfall([
    (wfCallback) => {
      utils.getStackConfig(baseURI, wfCallback)
    },
    (stackConfig, wfCallback) => {
      storage.connect((err, hashDb) => {
        if (err) return wfCallback(err)
        return wfCallback(null, stackConfig, hashDb)
      })
    },
    (stackConfig, hashDb, wfCallback) => {
      // The /hashes endpoint will only accept POST_HASHES_MAX hashes per request
      // if hashes contains more than POST_HASHES_MAX hashes, break the set up into multiple requests
      let hashSegments = []
      while (hashes.length > 0) hashSegments.push(hashes.splice(0, stackConfig.post_hashes_max))

      let allResults = []
      async.eachSeries(hashSegments, (hashSegment, eachCallback) => {
        // submit hashes
        submitHashes(stackConfig, hashDb, hashSegment, baseURI, (err, submitResults) => {
          if (err) return eachCallback(err)
          allResults = allResults.concat(submitResults)
          return eachCallback(null)
        })
      }, (err) => {
        if (err) return wfCallback(err)
        outputSubmitResults(allResults)
        return wfCallback(null)
      })
    }
  ], (err) => {
    if (err) console.error(`Submit error: ${err.message}`)
  })
}

function submitHashes (stackConfig, hashDb, hashArray, baseURI, callback) {
  let options = {
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST',
    uri: baseURI + '/hashes',
    body: { hashes: hashArray },
    json: true,
    gzip: true
  }
  async.waterfall([
    (wfCallback) => {
      request(options, (err, response, body) => {
        if (err) return wfCallback(err)
        if (response.statusCode !== 200) return wfCallback({ message: 'Invalid response' })
        return wfCallback(null, body)
      })
    },
    (responseBody, wfCallback) => {
      let submitResults = []

      async.eachSeries(responseBody.hashes, (hashItem, eachCallback) => {
        let row = {}
        row._id = hashItem.hash_id
        row.hash = hashItem.hash

        hashDb.insert(row, function (err, newRow) {
          if (err) return eachCallback(`HashItem submit error: ${err.message}`)
          submitResults.push(newRow)
          return eachCallback(null)
        })
      }, (err) => {
        if (err) return wfCallback(err)
        return wfCallback(null, submitResults)
      })
    }
  ], (err, submitResults) => {
    if (err) return callback(err)
    return callback(null, submitResults)
  })
}

function outputSubmitResults (submitResults) {
  _.each(submitResults, (hashItem) => {
    console.log(`hash_id : ${hashItem._id}`)
  })
}

module.exports = {
  execute: execute
}
