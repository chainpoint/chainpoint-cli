const utils = require('./utils.js')
const storage = require('./storage.js')
const async = require('async')
const cpb = require('chainpoint-binary')

function execute (yargs, argv) {
  // honor the quiet directive if set
  let quiet = argv.quiet || false

  // check for valid argument value
  let hashIdNode = argv._[1]
  let isValidHashId = utils.hashIdIsValid(hashIdNode)
  if (!isValidHashId) {
    yargs.showHelp()
    console.error(`Show error: Missing or invalid hash_id_node`)
    return
  }
  // parameters are valid, open storage and process verify
  async.waterfall([
    (wfCallback) => {
      storage.connect(wfCallback)
    },
    (hashDb, wfCallback) => {
      // retrieve the proof by hash_id_node
      hashDb.findOne({ _id: hashIdNode }, { proof: 1 }, (err, hashItem) => {
        if (err) return wfCallback(err)
        if (!hashItem || !hashItem.proof) return wfCallback({ message: `Cannot find proof for hash where hash_id_node = ${hashIdNode}` })

        let proofObj = null
        try {
          proofObj = cpb.binaryToObjectSync(hashItem.proof)
        } catch (err) { return wfCallback({ message: `Malformatted proof for hash where hash_id_node = ${hashIdNode}` }) }

        let proofJSON = JSON.stringify(proofObj, null, 2)
        if (!quiet) console.log(proofJSON)

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
