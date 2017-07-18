const utils = require('./utils.js')
const storage = require('./storage.js')
const async = require('async')

function execute (yargs, argv) {
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = argv.json || false

  // check for valid argument value
  let hashIdNode = argv._[1]
  let isValidHashId = utils.hashIdIsValid(hashIdNode)
  if (!isValidHashId) {
    yargs.showHelp()
    utils.log([`Delete error: Missing or invalid hash_id_node`], true, quiet, json)
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

        utils.log([`${hashIdNode} : deleted`], false, quiet, json)
        return wfCallback(null)
      })
    }
  ], (err) => {
    if (err) utils.log([`Delete error: ${err.message}`], true, quiet, json)
  })
}

module.exports = {
  execute: execute
}
