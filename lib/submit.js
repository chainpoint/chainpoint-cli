// load environment variables
const env = require('./parse-env.js')

const utils = require('./utils.js')
const storage = require('./storage.js')
const request = require('request')
const async = require('async')
const _ = require('lodash')
const HashItem = require('./models/HashItem.js').HashItem

function execute (yargs, argv) {
  // check for hash argument
  let hash = argv._[1]
  if (!utils.hashIsValid(hash)) {
    yargs.showHelp()
    console.log('Missing or invalid hash \n')
    return
  }
  // parameters are valid, open storage and process submit
  async.series([
    (callback) => {
      storage.connect(callback)
    },
    (callback) => {
      submitHashes([hash], (err, submitResults) => {
        if (err) return callback(err)
        outputSubmitResults(submitResults)
        return callback(null)
      })
    }
  ], (err) => {
    if (err) console.error(`HashItem submit error: ${err.message} : ${err.stack}`)
  })
}

function submitHashes (hashArray, callback) {
  let options = {
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST',
    uri: env.CHAINPOINT_API_BASE_URI + '/hashes',
    body: { hashes: hashArray },
    json: true,
    gzip: true
  }
  async.waterfall([
    (wfCallback) => {
      request(options, (err, response, body) => {
        if (err) return wfCallback(err)
        if (response.statusCode !== 200) return wfCallback(response.body.message)
        return wfCallback(null, body)
      })
    },
    (responseBody, wfCallback) => {
      let submitResults = []

      async.eachSeries(responseBody.hashes, (hashItem, eachCallback) => {
        let row = {}
        row.hashId = hashItem.hash_id
        row.hash = hashItem.hash

        HashItem.create(row)
          .then((newRow) => {
            submitResults.push(newRow.get({ plain: true }))
            return eachCallback(null)
          }).catch(err => {
            return eachCallback(`HashItem submit error: ${err.message} : ${err.stack}`)
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
    console.log(`${hashItem.hash} submitted and assigned a hash_id of ${hashItem.hashId}`)
  })
}

module.exports = {
  execute: execute
}
