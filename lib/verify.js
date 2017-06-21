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

  // check for valid argument value
  let hashId = argv._[1]
  let isValidHashId = utils.hashIdIsValid(hashId)
  if (!isValidHashId) {
    yargs.showHelp()
    console.log(`Verify error: Missing or invalid hash_id`)
    return
  }
  // parameters are valid, open storage and process verify
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
      // retrieve the proof by hash_id
      hashDb.findOne({ _id: hashId }, (err, hashItem) => {
        if (err) return wfCallback(err)
        if (!hashItem) return wfCallback({ message: `Cannot find proof for hash ${hashId}` })

        // run verification on proof
        verifyProofs(stackConfig, [hashItem.proof], baseURI, (err, verifyResults) => {
          if (err) return wfCallback(err)
          outputVerifyResults(verifyResults)
          return wfCallback(null)
        })
      })
    }
  ], (err) => {
    if (err) console.error(`Verify error: ${err.message}`)
  })
}

function verifyProofs (stackConfig, proofArray, baseURI, callback) {
  let options = {
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST',
    uri: baseURI + '/verify',
    body: { proofs: proofArray },
    json: true,
    gzip: true
  }
  request(options, (err, response, verifyResults) => {
    if (err) return callback(err)
    if (response.statusCode !== 200) return callback({message: 'Invalid response'})

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
