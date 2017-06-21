// load environment variables
const env = require('./parse-env.js')

const utils = require('./utils.js')
const storage = require('./storage.js')
const request = require('request')
const async = require('async')
const _ = require('lodash')
const updateCmd = require('./update.js')

function execute (yargs, argv) {
  // determine API base URI to use
  let baseURI = argv.server || env.CHAINPOINT_API_BASE_URI

  let updateAll = argv.all
  if (!updateAll) {
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
        updateCmd.updateHashesByHashId(stackConfig, hashDb, [hashId], baseURI, (err, updateResults) => {
          if (err) return wfCallback(err)
          if (updateResults[0].proof === null) return wfCallback({ message: `Cannot find proof for hash ${hashId}` })

          console.log('Proof data updated, starting verification')
          return wfCallback(null, stackConfig, hashDb)
        })
      },
      (stackConfig, hashDb, wfCallback) => {
        // retrieve the proof by hash_id
        hashDb.findOne({ _id: hashId }, (err, hashItem) => {
          if (err) return wfCallback(err)
          if (!hashItem || !hashItem.proof) return wfCallback({ message: `Cannot find proof for hash ${hashId}` })

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
  } else {
    // open storage and process update using hashes from local storage
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
        // retrieve hash_ids
        hashDb.find({}, { _id: 1 }, (err, hashItems) => {
          if (err) return wfCallback(err)
          return wfCallback(null, stackConfig, hashDb, hashItems)
        })
      },
      (stackConfig, hashDb, hashItems, wfCallback) => {
        // get hashId array
        let hashIds = hashItems.map((hashItem) => {
          return hashItem._id
        })
        // The /proofs endpoint will only accept GET_PROOFS_MAX_REST hash_ids per request
        // if hashIds contains more than GET_PROOFS_MAX_REST hash_ids, break the set up into multiple requests
        let hashIdSegments = []
        while (hashIds.length > 0) hashIdSegments.push(hashIds.splice(0, stackConfig.get_proofs_max_rest))

        async.eachSeries(hashIdSegments, (hashIdSegment, eachCallback) => {
          // retrieve latest proofs
          updateCmd.updateHashesByHashId(stackConfig, hashDb, hashIdSegment, baseURI, (err, updateResults) => {
            if (err) return eachCallback(err)
            return eachCallback(null)
          })
        }, (err) => {
          if (err) return wfCallback(err)
          console.log('Proof data updated, starting verification')
          return wfCallback(null, stackConfig, hashDb)
        })
      },
      (stackConfig, hashDb, wfCallback) => {
        // retrieve hash_ids
        hashDb.find({}, { _id: 1, proof: 1 }, (err, hashItems) => {
          if (err) return wfCallback(err)
          return wfCallback(null, stackConfig, hashDb, hashItems)
        })
      },
      (stackConfig, hashDb, hashItems, wfCallback) => {
        // filter out all hashes with no proof data
        hashItems = hashItems.filter((hashItem) => {
          if (hashItem.proof == null) {
            console.log(`Proof for hash_id ${hashItem._id} is not yet available`)
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
        async.eachSeries(proofSegments, (proofSegment, eachCallback) => {
          // verify proofs
          verifyProofs(stackConfig, proofSegment, baseURI, (err, verifyResults) => {
            if (err) return eachCallback(err)
            allResults = allResults.concat(verifyResults)
            return eachCallback(null)
          })
        }, (err) => {
          if (err) return wfCallback(err)
          outputVerifyResults(allResults)
          return wfCallback(null)
        })
      }
    ], (err) => {
      if (err) console.error(`Verify error: ${err.message}`)
    })
  }
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
    if (response.statusCode !== 200) return callback({ message: 'Invalid response' })

    return callback(null, verifyResults)
  })
}

function outputVerifyResults (verifyResults) {
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
    console.log(`${proof.hash_id} | ${proof.status} | ${proofAnchorsString}`)
  })
}

module.exports = {
  execute: execute
}
