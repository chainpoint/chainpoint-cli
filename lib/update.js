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
        updateHashesByHashId([hashId])
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
            // TODO: Account for max proofs per request to API
            // retrieve latest proofs
            updateHashesByHashId(hashIds)
          })
      }
    })
  }
}

function updateHashesByHashId (hashIdArray) {
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
  request(options, function (err, response, body) {
    if (err) {
      console.error(err)
      return
    }
    if (response.statusCode !== 200) {
      console.error(response.body.message)
      return
    }

    async.each(body, function (hashItem, eachCallback) {
      if (hashItem.proof === null) {
        console.log(`${hashItem.hash_id} has no proof data`)
        return eachCallback(null)
      } else {
        cpb.binaryToObject(hashItem.proof, function (err, proofObject) {
          if (err) {
            console.log(`Could not parse proof for hash_id ${hashItem.hash_id}`)
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
                console.log(`${hashItem.hash_id} updated with latest proof data`)
                return eachCallback(null)
              }).catch(err => {
                return eachCallback(`HashItem update error: ${err.message} : ${err.stack}`)
              })
          }
        })
      }
    }, function (err) {
      if (err) {
        console.error(err)
      }
    })
  })
}

module.exports = {
  execute: execute
}
