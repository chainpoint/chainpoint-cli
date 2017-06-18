const utils = require('./utils.js')
const storage = require('./storage.js')
const async = require('async')
const _ = require('lodash')
const cpb = require('chainpoint-binary')
const HashItem = require('./models/HashItem.js').HashItem

function execute (yargs, argv) {
  // check for hash argument
  let filePath = argv.proof
  let proofDataString = utils.readFile(filePath)
  if (!proofDataString) {
    console.log('Cannot find file at that path \n')
    return
  }
  // interpret proofData and get proof base64 string
  let proofBase64 = utils.interpretProof(proofDataString)
  if (!proofBase64) {
    console.log('Not a valid Chainpoint v3 proof \n')
    return
  }
  // parameters are valid, open storage and process submit
  async.series([
    (callback) => {
      storage.connect(callback)
    },
    (callback) => {
      let proofObject = cpb.binaryToObjectSync(proofBase64)
      let row = {}
      let hasEth = false
      let hasBtc = false

      let afterCalBranches = proofObject.branches[0].branches
      _.each(afterCalBranches, (branch) => {
        let anchorType = branch.ops[branch.ops.length - 1].anchors[0].type
        switch (anchorType) {
          case 'eth':
            hasEth = true
            break
          case 'btc':
            hasBtc = true
            break
        }
      })

      row.hashId = proofObject.hash_id
      row.hash = proofObject.hash
      row.cal = true
      row.eth = hasEth
      row.btc = hasBtc
      row.proof = proofBase64

      HashItem.upsert(row)
        .then(() => {
          return callback(null)
        }).catch(err => {
          return callback(err)
        })
    }
  ], (err) => {
    if (err) console.error(`Import error: ${err.message} : ${err.stack}`)
  })
}

module.exports = {
  execute: execute
}
