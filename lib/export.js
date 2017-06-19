const utils = require('./utils.js')
const storage = require('./storage.js')
const async = require('async')
const cpb = require('chainpoint-binary')
const HashItem = require('./models/HashItem.js').HashItem

function execute (yargs, argv) {
  // check for valid argument value
  let hashId = argv._[1]
  let isValidHashId = utils.hashIdIsValid(hashId)
  if (!isValidHashId) {
    yargs.showHelp()
    console.log(`Invalid hash_id - ${hashId}\n`)
    return
  }
  // parameters are valid, open storage and process export
  async.series([
    (callback) => {
      storage.connect(callback)
    },
    (callback) => {
      // retrieve the proof by hash_id
      HashItem.find({ where: { hashId: hashId } }).then((hashItem) => {
        if (!hashItem) {
          console.log(`Cannot find proof for hash ${hashId}`)
          return
        }
        // save file
        let exportAsJSON = !argv.binary
        let filename = `${hashItem.hashId}.chp${exportAsJSON ? '.json' : ''}`
        let path = `./${filename}`
        let proofObj = cpb.binaryToObjectSync(hashItem.proof)
        let writeSuccess = false
        if (exportAsJSON) { // save the proof as a JSON string with extension .chp.json
          let proofJSON = JSON.stringify(proofObj, null, 2)
          writeSuccess = utils.writeFile(path, proofJSON)
        } else { // save the proof as binary data with extension .chp
          let proofBin = cpb.objectToBinarySync(proofObj)
          writeSuccess = utils.writeFile(path, proofBin)
        }
        if (!writeSuccess) {
          console.log(`Cannot find proof for hash ${hashId}`)
        } else {
          console.log(`${filename} exported`)
        }
        return callback(null)
      })
    }
  ], (err) => {
    if (err) console.error(`Verify error: ${err.message}`)
  })
}

module.exports = {
  execute: execute
}
