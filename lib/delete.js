const utils = require('./utils.js')
const storage = require('./storage.js')
const async = require('async')

function execute (yargs, argv) {
  // check for valid argument value
  let hashIdNode = argv._[1]
  let isValidHashId = utils.hashIdIsValid(hashIdNode)
  if (!isValidHashId) {
    yargs.showHelp()
    console.log(`Delete error: Missing or invalid hash_id_node`)
    return
  }
  // parameters are valid, open storage and process verify
  async.waterfall([
    (wfCallback) => {
      storage.connect(wfCallback)
    },
    (hashDb, wfCallback) => {
      // delete the record by hash_id_node
      hashDb.remove({ _id: hashIdNode }, {}, (err, numRemoved) => {
        if (err) return wfCallback(err)
        if (numRemoved < 1) return wfCallback({ message: `Not Found : ${hashIdNode}` })

        console.log(`${hashIdNode} : deleted`)
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
