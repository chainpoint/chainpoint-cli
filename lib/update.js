// load environment variables
const env = require('./parse-env.js')

const utils = require('./utils.js')
const storage = require('./storage.js')
const request = require('request')
const async = require('async')
const _ = require('lodash')
const cpb = require('chainpoint-binary')

function execute (yargs, argv) {
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = argv.json || false

  // determine API base URI to use
  let baseURI = argv.server || env.CHAINPOINT_NODE_API_BASE_URI

  let updateAll = argv.all
  if (!updateAll) {
    // check for valid argument value
    let hashIdNode = argv._[1]
    let isValidHashId = utils.hashIdIsValid(hashIdNode)
    if (!isValidHashId) {
      yargs.showHelp()
      utils.log([`Update error: Missing or invalid hash_id_node`], true, quiet, json)
      return
    }
    // parameters are valid, open storage and process update
    async.waterfall([
      (wfCallback) => {
        utils.getStackConfig(baseURI, (err, stackConfig) => {
          if (err) return wfCallback(err)
          // check hash_id_node age for expiration
          if (utils.hashIdExpired(stackConfig.proof_expire_minutes, hashIdNode)) { // this hash has expired
            return wfCallback({ message: `Expired hash_id_node: ${hashIdNode}` })
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
        updateHashesByHashIdNode(stackConfig, hashDb, [hashIdNode], baseURI, (err, updateResults) => {
          if (err) return wfCallback(err)
          outputUpdateResults(updateResults, quiet, json)
          return wfCallback(null)
        })
      }
    ], (err) => {
      if (err) utils.log([`Update error: ${err.message}`], true, quiet, json)
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
        // retrieve hash_id_nodess, filtering out those older than PROOF_EXPIRE_MINUTES
        let oldestDate = new Date(new Date() - stackConfig.proof_expire_minutes * 60 * 1000)
        hashDb.find({ createdAt: { $gte: oldestDate } }, { _id: 1 }, (err, hashItems) => {
          if (err) return wfCallback(err)
          return wfCallback(null, stackConfig, hashDb, hashItems)
        })
      },
      (stackConfig, hashDb, hashItems, wfCallback) => {
        // get hashIdNode array
        let hashIdNodes = hashItems.map((hashItem) => {
          return hashItem._id
        })
        // filter out those older than PROOF_EXPIRE_MINUTES
        // this is a secondary check based on UUID instead of create_at record
        hashIdNodes = hashIdNodes.filter((hashIdNode) => {
          return !utils.hashIdExpired(stackConfig.proof_expire_minutes, hashIdNode)
        })
        // The /proofs endpoint will only accept GET_PROOFS_MAX_REST hash_id_nodes per request
        // if hashIdNodes contains more than GET_PROOFS_MAX_REST hash_id_nodes, break the set up into multiple requests
        let hashIdNodeSegments = []
        while (hashIdNodes.length > 0) hashIdNodeSegments.push(hashIdNodes.splice(0, stackConfig.get_proofs_max_rest))

        let allResults = []

        async.eachSeries(hashIdNodeSegments, (hashIdNodeSegment, eachCallback) => {
          // retrieve latest proofs
          updateHashesByHashIdNode(stackConfig, hashDb, hashIdNodeSegments, baseURI, (err, updateResults) => {
            if (err) return eachCallback(err)
            allResults = allResults.concat(updateResults)
            return eachCallback(null)
          })
        }, (err) => {
          if (err) return wfCallback(err)
          outputUpdateResults(allResults, quiet, json)
          return wfCallback(null)
        })
      }
    ], (err) => {
      if (err) utils.log([`Update error: ${err.message}`], true, quiet, json)
    })
  }
}

function updateHashesByHashIdNode (stackConfig, hashDb, hashIdNodeArray, baseURI, callback) {
  let hashIdNodesCSV = hashIdNodeArray.join(',')
  let options = {
    headers: {
      'Content-Type': 'application/json',
      hashids: hashIdNodesCSV
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
          updateResults.push({ hash_id_node: hashItem.hash_id_node, proof: null })
          return eachCallback(null)
        } else {
          let proofObject = null
          try {
            proofObject = cpb.binaryToObjectSync(hashItem.proof)
          } catch (err) {
            updateResults.push({ hash_id_node: hashItem.hash_id_node, proof: '' })
            return eachCallback(null)
          }
          let updateData = {}

          let anchorsComplete = utils.parseAnchorsComplete(proofObject)

          updateData.cal = anchorsComplete.includes('cal')
          updateData.eth = anchorsComplete.includes('eth')
          updateData.btc = anchorsComplete.includes('btc')
          updateData.proof = hashItem.proof

          hashDb.update({ _id: hashItem.hash_id_node }, { $set: updateData }, {}, (err, numReplaced) => {
            if (err) return eachCallback(`HashItem update error: ${err.message}`)
            updateResults.push({ hash_id_node: hashItem.hash_id_node, proof: hashItem.proof })
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

function outputUpdateResults (updateResults, quiet, json) {
  let items = []
  _.each(updateResults, (hashItem) => {
    switch (hashItem.proof) {
      case null:
        items.push(`Hash with hash_id_node = ${hashItem.hash_id_node} has no proof data`)
        break
      case '':
        items.push(`Could not parse proof for hash with hash_id_node  = ${hashItem.hash_id_node}`)
        break
      default:
        items.push(`Hash with hash_id_node = ${hashItem.hash_id_node} updated with latest proof data`)
    }
  })
  utils.log(items, false, quiet, json)
}

module.exports = {
  execute: execute,
  updateHashesByHashIdNode: updateHashesByHashIdNode
}
