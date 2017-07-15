// load environment variables
const env = require('./parse-env.js')

const utils = require('./utils.js')
const storage = require('./storage.js')
const async = require('async')
const cpb = require('chainpoint-binary')
const updateCmd = require('./update.js')

function execute (yargs, argv) {
  // determine API base URI to use
  let baseURI = argv.server || env.CHAINPOINT_NODE_API_BASE_URI

  // check for valid argument value
  let hashIdNode = argv._[1]
  let isValidHashId = utils.hashIdIsValid(hashIdNode)
  if (!isValidHashId) {
    yargs.showHelp()
    console.log(`Export error: Missing or invalid hash_id_node`)
    return
  }
  // parameters are valid, open storage and process export
  async.waterfall([
    (wfCallback) => {
      utils.getStackConfig(baseURI, wfCallback)
    },
    (stackConfig, wfCallback) => {
      storage.connect((err, hashDb) => {
        if (err) return wfCallback(err)
        return wfCallback(null, stackConfig, hashDb)
      })
    },
    (stackConfig, hashDb, wfCallback) => {
      updateCmd.updateHashesByHashIdNode(stackConfig, hashDb, [hashIdNode], baseURI, (err, updateResults) => {
        if (err) return wfCallback(err)
        if (updateResults[0].proof === null) return wfCallback({ message: `Cannot find proof for hash where hash_id_node = ${hashIdNode}` })
        return wfCallback(null, hashDb)
      })
    },
    (hashDb, wfCallback) => {
      // retrieve the proof by hash_id_node
      hashDb.findOne({ _id: hashIdNode }, (err, hashItem) => {
        if (err) return wfCallback(err)
        if (!hashItem || !hashItem.proof) return wfCallback({ message: `Cannot find proof for hash where hash_id_node = ${hashIdNode}` })

        // save file
        let exportAsJSON = !argv.binary
        let filename = `${hashItem._id}.chp${exportAsJSON ? '.json' : ''}`
        let path = `./${filename}`
        let proofObj = null
        try {
          proofObj = cpb.binaryToObjectSync(hashItem.proof)
        } catch (err) { return wfCallback({ message: `Malformatted proof for hash where hash_id_node = ${hashIdNode}` }) }
        let writeSuccess = false
        if (exportAsJSON) { // save the proof as a JSON string with extension .chp.json
          let proofJSON = JSON.stringify(proofObj, null, 2)
          writeSuccess = utils.writeFile(path, proofJSON)
        } else { // save the proof as binary data with extension .chp
          let proofBin = cpb.objectToBinarySync(proofObj)
          writeSuccess = utils.writeFile(path, proofBin)
        }
        if (!writeSuccess) return wfCallback({ message: `Cannot find proof for hash where hash_id_node = ${hashIdNode}` })

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
