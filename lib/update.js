// load environment variables
const env = require('./parse-env.js')

const utils = require('./utils.js')
const storage = require('./storage.js')
const request = require('request')
const async = require('async')
const _ = require('lodash')
const cpb = require('chainpoint-binary')
const HashItem = require('./models/HashItem.js').HashItem

function execute (yargs, argv) {
  // check for argument
  let hasArgument = argv._.length > 1
  if (hasArgument) {
    // check for valid argument value
    let hashId = argv._[1]
    let isValidHashId = utils.hashIdIsValid(hashId)
    if (!isValidHashId) {
      yargs.showHelp()
      console.log(`Invalid hash_id - ${hashId}\n`)
      return
    }
    // check hash_id age for expiration
    if (utils.hashIdExpired(hashId)) { // this hash has expired
      console.log(`Expired hash_id - ${hashId}\n`)
      return
    }
    // parameters are valid, open storage and process update
    async.series([
      (callback) => {
        storage.connect(callback)
      },
      (callback) => {
        updateHashesByHashId([hashId], (err, updateResults) => {
          if (err) return callback(err)
          outputUpdateResults(updateResults)
          return callback(null)
        })
      }
    ], (err) => {
      if (err) console.error(`Update error: ${err.message} : ${err.stack}`)
    })
  } else {
    // open storage and process update using hashes from local storage
    async.waterfall([
      (callback) => {
        storage.connect(callback)
      },
      (callback) => {
        // retrieve hash_ids, filtering out those older than PROOF_EXPIRE_MINUTES
        let oldestDate = new Date(new Date() - env.PROOF_EXPIRE_MINUTES * 60 * 1000)
        HashItem.findAll({ where: { created_at: { $gte: oldestDate } }, attributes: ['hashId'] }).then((hashItems) => {
          return callback(null, hashItems)
        })
      },
      (hashItems, callback) => {
        // get hashId array
        let hashIds = hashItems.map((hashItem) => {
          return hashItem.hashId
        })
        // filter out those older than PROOF_EXPIRE_MINUTES
        // this is a secondary check based on UUID instead of create_at record
        hashIds = hashIds.filter((hashId) => {
          return !utils.hashIdExpired(hashId)
        })
        // The /proofs endpoint will only accept 250 hash_ids per request
        // if hashIds contains more than 250 hash_ids, break the set up into multiple requests
        let hashIdSegments = []
        while (hashIds.length > 0) hashIdSegments.push(hashIds.splice(0, 250))

        let allResults = []

        async.eachSeries(hashIdSegments, (hashIdSegment, eachCallback) => {
          // retrieve latest proofs
          updateHashesByHashId(hashIdSegment, (err, updateResults) => {
            if (err) return eachCallback(err)
            allResults = allResults.concat(updateResults)
            return eachCallback(null)
          })
        }, (err) => {
          if (err) return callback(err)
          outputUpdateResults(allResults)
          return callback(null)
        })
      }
    ], (err) => {
      if (err) console.error(`Update error: ${err.message} : ${err.stack}`)
    })
  }
}

function updateHashesByHashId (hashIdArray, callback) {
  let hashIdCSV = hashIdArray.join(',')
  let options = {
    headers: {
      'Content-Type': 'application/json',
      hashids: hashIdCSV
    },
    method: 'GET',
    uri: env.CHAINPOINT_API_BASE_URI + '/proofs',
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

          HashItem.update(updateData, { where: { hashId: hashItem.hash_id } })
            .then((result) => {
              updateResults.push({ hash_id: hashItem.hash_id, proof: hashItem.proof })
              return eachCallback(null)
            }).catch(err => {
              return eachCallback(`HashItem update error: ${err.message} : ${err.stack}`)
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
