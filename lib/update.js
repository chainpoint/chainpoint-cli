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
    storage.connect((err) => {
      if (err) {
        console.error(`HashItem update error: ${err.message} : ${err.stack}`)
      } else {
        updateHashesByHashId([hashId], (err, updateResults) => {
          if (err) {
            console.error(err)
          } else {
            outputUpdateResults(updateResults)
          }
        })
      }
    })
  } else {
    // open storage and process update using hashes from local storage
    storage.connect((err) => {
      if (err) {
        console.error(`HashItem update error: ${err.message} : ${err.stack}`)
      } else {
        // retrieve hash_ids
        HashItem.findAll({ attributes: ['hashId'] })
          .then((hashItems) => {
            // get hashId array
            let hashIds = hashItems.map((hashItem) => {
              return hashItem.hashId
            })
            // filter out those older than PROOF_EXPIRE_MINUTES
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
              if (err) {
                console.error(err)
              } else {
                outputUpdateResults(allResults)
              }
            })
          })
      }
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
  request(options, (err, response, body) => {
    if (err) return callback(err)
    if (response.statusCode !== 200) return callback(response.body.message)

    let updateResults = []

    async.eachSeries(body, (hashItem, eachCallback) => {
      if (hashItem.proof === null) {
        updateResults.push({ hash_id: hashItem.hash_id, proof: null })
        return eachCallback(null)
      } else {
        cpb.binaryToObject(hashItem.proof, (err, proofObject) => {
          if (err) {
            updateResults.push({ hash_id: hashItem.hash_id, proof: '' })
            return eachCallback(null)
          } else {
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
        })
      }
    }, (err) => {
      if (err) return callback(err)
      return callback(null, updateResults)
    })
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
