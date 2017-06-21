const utils = require('./utils.js')
const storage = require('./storage.js')
const async = require('async')

function execute (yargs, argv) {
  // check for valid argument value
  let hashId = argv._[1]
  let isValidHashId = utils.hashIdIsValid(hashId)
  if (!isValidHashId) {
    yargs.showHelp()
    console.log(`Delete error: Missing or invalid hash_id`)
    return
  }
  // parameters are valid, open storage and process verify
  async.waterfall([
    (wfCallback) => {
      storage.connect(wfCallback)
    },
    (hashDb, wfCallback) => {
      // delete the record by hash_id
      hashDb.remove({ _id: hashId }, {}, (err, numRemoved) => {
        if (err) return wfCallback(err)
        if (numRemoved < 1) return wfCallback({ message: `Not Found : ${hashId}` })

        console.log(`${hashId} : deleted`)
        return wfCallback(null)
      })
    }
  ], (err) => {
    if (err) console.error(`Delete error: ${err.message}`)
  })
}

module.exports = {
  execute: execute
}
