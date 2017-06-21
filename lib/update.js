// load environment variables
const env = require('./parse-env.js')

const utils = require('./utils.js')
const storage = require('./storage.js')
const request = require('request')
const async = require('async')
const _ = require('lodash')
const cpb = require('chainpoint-binary')

function execute (yargs, argv) {
  // determine API base URI to use
  let baseURI = argv.server || env.CHAINPOINT_API_BASE_URI

  // check for argument
  let hasArgument = argv._.length > 1
  if (hasArgument) {
    // check for valid argument value
    let hashId = argv._[1]
    let isValidHashId = utils.hashIdIsValid(hashId)
    if (!isValidHashId) {
      yargs.showHelp()
      console.log(`Update error: Invalid hash_id: ${hashId}`)
      return
    }
    // parameters are valid, open storage and process update
    async.waterfall([
      (wfCallback) => {
        utils.getStackConfig(baseURI, (err, stackConfig) => {
          if (err) return wfCallback(err)
          // check hash_id age for expiration
          if (utils.hashIdExpired(stackConfig.proof_expire_minutes, hashId)) { // this hash has expired
            return wfCallback({ message: `Expired hash_id: ${hashId}` })
          }
          return wfCallback(null, stackConfig)
        })
      },
      (stackConfig, wfCallback) => {
        storage.connect((err, hashDb) => {
          if (err) return wfCallback(err)
          return wfCallback(null, stackConfig, hashDb)
        })
      },
      (stackConfig, hashDb, wfCallback) => {
        updateHashesByHashId(stackConfig, hashDb, [hashId], baseURI, (err, updateResults) => {
          if (err) return wfCallback(err)
          outputUpdateResults(updateResults)
          return wfCallback(null)
        })
      }
    ], (err) => {
      if (err) console.error(`Update error: ${err.message}`)
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
        // retrieve hash_ids, filtering out those older than PROOF_EXPIRE_MINUTES
        let oldestDate = new Date(new Date() - stackConfig.proof_expire_minutes * 60 * 1000)
        hashDb.find({ createdAt: { $gte: oldestDate } }, { _id: 1 }, (err, hashItems) => {
          if (err) return wfCallback(err)
          return wfCallback(null, stackConfig, hashDb, hashItems)
        })
      },
      (stackConfig, hashDb, hashItems, wfCallback) => {
        // get hashId array
        let hashIds = hashItems.map((hashItem) => {
          return hashItem._id
        })
        // filter out those older than PROOF_EXPIRE_MINUTES
        // this is a secondary check based on UUID instead of create_at record
        hashIds = hashIds.filter((hashId) => {
          return !utils.hashIdExpired(stackConfig.proof_expire_minutes, hashId)
        })
        // The /proofs endpoint will only accept GET_PROOFS_MAX_REST hash_ids per request
        // if hashIds contains more than GET_PROOFS_MAX_REST hash_ids, break the set up into multiple requests
        let hashIdSegments = []
        while (hashIds.length > 0) hashIdSegments.push(hashIds.splice(0, stackConfig.get_proofs_max_rest))

        let allResults = []

        async.eachSeries(hashIdSegments, (hashIdSegment, eachCallback) => {
          // retrieve latest proofs
          updateHashesByHashId(stackConfig, hashDb, hashIdSegment, baseURI, (err, updateResults) => {
            if (err) return eachCallback(err)
            allResults = allResults.concat(updateResults)
            return eachCallback(null)
          })
        }, (err) => {
          if (err) return wfCallback(err)
          outputUpdateResults(allResults)
          return wfCallback(null)
        })
      }
    ], (err) => {
      if (err) console.error(`Update error: ${err.message}`)
    })
  }
}

function updateHashesByHashId (stackConfig, hashDb, hashIdArray, baseURI, callback) {
  let hashIdCSV = hashIdArray.join(',')
  let options = {
    headers: {
      'Content-Type': 'application/json',
      hashids: hashIdCSV
    },
    method: 'GET',
    uri: baseURI + '/proofs',
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
      let updateResults = []

      async.eachSeries(responseBody, (hashItem, eachCallback) => {
        if (hashItem.proof === null) {
          updateResults.push({ hash_id: hashItem.hash_id, proof: null })
          return eachCallback(null)
        } else {
          let proofObject = null
          try {
            proofObject = cpb.binaryToObjectSync(hashItem.proof)
          } catch (err) {
            updateResults.push({ hash_id: hashItem.hash_id, proof: '' })
            return eachCallback(null)
          }
          let updateData = {}
          updateData.cal = true // if we've gotten this far, the cal branch must at least exist
          let afterCalBranches = proofObject.branches[0].branches
          _.each(afterCalBranches, (branch) => {
            let anchorType = branch.ops[branch.ops.length - 1].anchors[0].type
            switch (anchorType) {
              case 'eth':
                updateData.eth = true
                break
              case 'btc':
                updateData.btc = true
                break
            }
          })
          updateData.proof = hashItem.proof

          hashDb.update({ _id: hashItem.hash_id }, { $set: updateData }, {}, (err, numReplaced) => {
            if (err) return eachCallback(`HashItem update error: ${err.message}`)
            updateResults.push({ hash_id: hashItem.hash_id, proof: hashItem.proof })
            return eachCallback(null)
          })
        }
      }, (err) => {
        if (err) return wfCallback(err)
        return wfCallback(null, updateResults)
      })
    }
  ], (err, updateResults) => {
    if (err) return callback(err)
    return callback(null, updateResults)
  })
}

function outputUpdateResults (updateResults) {
  _.each(updateResults, (hashItem) => {
    switch (hashItem.proof) {
      case null:
        console.log(`${hashItem.hash_id} has no proof data`)
        break
      case '':
        console.log(`Could not parse proof for hash_id ${hashItem.hash_id}`)
        break
      default:
        console.log(`${hashItem.hash_id} updated with latest proof data`)
    }
  })
}

module.exports = {
  execute: execute
}
