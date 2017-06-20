const utils = require('./utils.js')
const storage = require('./storage.js')
const async = require('async')
const _ = require('lodash')
const cpb = require('chainpoint-binary')

function execute (yargs, argv) {
  // check for valid filepath argument
  let filePath = argv.proof
  let isBinaryFile = filePath.endsWith('.chp')
  let isJSONFile = filePath.endsWith('.chp.json')
  if (!isBinaryFile && !isJSONFile) {
    console.log('Import error: Unknown file type')
    return
  }

  let proofFileData = utils.readFile(filePath, isBinaryFile)
  if (!proofFileData) {
    console.log('Import error: Cannot find file at that path')
    return
  }

  // read proofData and get proof JSON object
  let proofObject = utils.readProofObject(proofFileData, isBinaryFile)
  if (!proofObject) {
    console.log('Import error: Not a valid Chainpoint v3 proof')
    return
  }
  // parameters are valid, open storage and process submit
  async.waterfall([
    (wfcallback) => {
      storage.connect(wfcallback)
    },
    (hashDb, wfcallback) => {
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

      row._id = proofObject.hash_id
      row.hash = proofObject.hash
      row.cal = true
      row.eth = hasEth
      row.btc = hasBtc
      row.proof = cpb.objectToBase64Sync(proofObject)

      hashDb.update({ _id: proofObject.hash_id }, row, { upsert: true }, (err, numReplaced, upsert) => {
        if (err) return wfcallback(err)
        console.log(`${filePath} imported`)
        return wfcallback(null)
      })
    }
  ], (err) => {
    if (err) console.error(`Import error: ${err.message}`)
  })
}

module.exports = {
  execute: execute
}
