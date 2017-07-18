const utils = require('./utils.js')
const storage = require('./storage.js')
const async = require('async')

function execute (yargs, argv) {
  // honor the quiet directive if set
  let quiet = argv.quiet || false

  // check for valid argument value
  let hashIdNode = argv._[1]
  let isValidHashId = utils.hashIdIsValid(hashIdNode)
  if (!isValidHashId) {
    yargs.showHelp()
    console.error(`Delete error: Missing or invalid hash_id_node`)
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

        if (!quiet) console.log(`${hashIdNode} : deleted`)
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
