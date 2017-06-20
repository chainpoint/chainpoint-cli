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

  // check for hash argument
  let hash = argv._[1]
  if (!utils.hashIsValid(hash)) {
    yargs.showHelp()
    console.log('Submit error: Missing or invalid hash ')
    return
  }
  // parameters are valid, open storage and process submit
  async.waterfall([
    (wfCallback) => {
      storage.connect(wfCallback)
    },
    (hashDb, wfCallback) => {
      submitHashes(hashDb, [hash], baseURI, (err, submitResults) => {
        if (err) return wfCallback(err)
        outputSubmitResults(submitResults)
        return wfCallback(null)
      })
    }
  ], (err) => {
    if (err) console.error(`Submit error: ${err.message}`)
  })
}

function submitHashes (hashDb, hashArray, baseURI, callback) {
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
