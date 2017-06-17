// load environment variables
const env = require('./parse-env.js')

const utils = require('./utils.js')
const storage = require('./storage.js')
const request = require('request')
const async = require('async')
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
  storage.connect((err) => {
    if (err) {
      console.error(`HashItem submit error: ${err.message} : ${err.stack}`)
    } else {
      submitHashes([hash], (err, results) => {
        if (err) {
          console.error(err)
        }
      })
    }
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
  request(options, (err, response, body) => {
    if (err) return callback(err)
    if (response.statusCode !== 200) return callback(response.body.message)

    async.each(body.hashes, (hashItem, eachCallback) => {
      let now = Date.now()
      let row = {}
      row.hashId = hashItem.hash_id
      row.hash = hashItem.hash
      row.createdAt = now
      row.updatedAt = now

      HashItem.create(row)
        .then((newRow) => {
          let hashItem = newRow.get({ plain: true })
          console.log(`${hashItem.hash} submitted and assigned a hash_id of ${hashItem.hashId}`)
          return eachCallback(null)
        }).catch(err => {
          return eachCallback(`HashItem submit error: ${err.message} : ${err.stack}`)
        })
    }, (err) => {
      if (err) return callback(err)
      return callback(null)
    })
  })
}

module.exports = {
  execute: execute
}
