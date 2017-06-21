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
    console.log(`Verify error: Missing or invalid hash_id`)
    return
  }
  // parameters are valid, open storage and process verify
  async.waterfall([
    (wfCallback) => {
      storage.connect(wfCallback)
    },
    (hashDb, wfCallback) => {
      // retrieve the proof by hash_id
      hashDb.findOne({ _id: hashId }, { proof: 1 }, (err, hashItem) => {
        if (err) return wfCallback(err)
        if (!hashItem || !hashItem.proof) return wfCallback({ message: `Cannot find proof for hash ${hashId}` })

        let proofObj = null
        try {
          proofObj = cpb.binaryToObjectSync(hashItem.proof)
        } catch (err) { return wfCallback({ message: `Malformatted proof for hash ${hashId}` }) }

        let proofJSON = JSON.stringify(proofObj, null, 2)
        console.log(proofJSON)

        return wfCallback(null)
      })
    }
  ], (err) => {
    if (err) console.error(`Show error: ${err.message}`)
  })
}

module.exports = {
  execute: execute
}
