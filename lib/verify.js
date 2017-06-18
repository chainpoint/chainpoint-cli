// load environment variables
const env = require('./parse-env.js')

const utils = require('./utils.js')
const storage = require('./storage.js')
const request = require('request')
const async = require('async')
const _ = require('lodash')
const HashItem = require('./models/HashItem.js').HashItem

function execute (yargs, argv) {
  // check for valid argument value
  let hashId = argv._[1]
  let isValidHashId = utils.hashIdIsValid(hashId)
  if (!isValidHashId) {
    yargs.showHelp()
    console.log(`Missing or invalid hash_id \n`)
    return
  }
  // parameters are valid, open storage and process verify
  async.series([
    (callback) => {
      storage.connect(callback)
    },
    (callback) => {
      // retrieve the proof by hash_id
      HashItem.find({ where: { hashId: hashId } }).then((hashItem) => {
        if (!hashItem) {
          console.log(`Cannot find proof for hash ${hashId} \n`)
          return
        }
        // run verification on proof
        verifyProofs([hashItem.proof], (err, verifyResults) => {
          if (err) return callback(err)
          outputVerifyResults(verifyResults)
          return callback(null)
        })
      })
    }
  ], (err) => {
    if (err) console.error(`Verify error: ${err.message} : ${err.stack}`)
  })
}

function verifyProofs (proofArray, callback) {
  let options = {
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST',
    uri: env.CHAINPOINT_API_BASE_URI + '/verify',
    body: { proofs: proofArray },
    json: true,
    gzip: true
  }
  request(options, (err, response, verifyResults) => {
    if (err) callback(err)
    if (response.statusCode !== 200) callback(response.body.message)

    return callback(null, verifyResults)
  })
}

function outputVerifyResults (verifyResults) {
  _.each(verifyResults, (proof) => {
    console.log(`Proof for hash_id ${proof.hash_id || '(not found)'} is ${proof.status} `)
  })
}

module.exports = {
  execute: execute
}
