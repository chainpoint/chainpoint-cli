const utils = require('./utils.js')
const storage = require('./storage.js')
const async = require('async')
const cpb = require('chainpoint-binary')

function execute (yargs, argv) {
  // check for valid argument value
  let hashId = argv._[1]
  let isValidHashId = utils.hashIdIsValid(hashId)
  if (!isValidHashId) {
    yargs.showHelp()
    console.log(`Export error: Missing or invalid hash_id`)
    return
  }
  // parameters are valid, open storage and process export
  async.waterfall([
    (wfCallback) => {
      storage.connect(wfCallback)
    },
    (hashDb, wfCallback) => {
      // retrieve the proof by hash_id
      hashDb.findOne({ _id: hashId }, (err, hashItem) => {
        if (err) return wfCallback(err)
        if (!hashItem || !hashItem.proof) return wfCallback({ message: `Cannot find proof for hash ${hashId}` })

        // save file
        let exportAsJSON = !argv.binary
        let filename = `${hashItem._id}.chp${exportAsJSON ? '.json' : ''}`
        let path = `./${filename}`
        let proofObj = null
        try {
          proofObj = cpb.binaryToObjectSync(hashItem.proof)
        } catch (err) { return wfCallback({ message: `Malformatted proof for hash ${hashId}` }) }
        let writeSuccess = false
        if (exportAsJSON) { // save the proof as a JSON string with extension .chp.json
          let proofJSON = JSON.stringify(proofObj, null, 2)
          writeSuccess = utils.writeFile(path, proofJSON)
        } else { // save the proof as binary data with extension .chp
          let proofBin = cpb.objectToBinarySync(proofObj)
          writeSuccess = utils.writeFile(path, proofBin)
        }
        if (!writeSuccess) return wfCallback({ message: `Cannot find proof for hash ${hashId}` })

        console.log(`${filename} exported`)
        return wfCallback(null)
      })
    }
  ], (err) => {
    if (err) console.error(`Export error: ${err.message}`)
  })
}

module.exports = {
  execute: execute
}
