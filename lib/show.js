const utils = require('./utils.js')
const storage = require('./storage.js')
const cpb = require('chainpoint-binary')

async function executeAsync (yargs, argv) {
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = false // temp disabled // argv.json || false

  // check for valid argument value
  let hashIdNode = argv._[1]
  let isValidHashId = utils.hashIdIsValid(hashIdNode)
  if (!isValidHashId) {
    yargs.showHelp()
    utils.log([`Show error: Missing or invalid hash_id_node`], true, quiet, json)
    return
  }
  // parameters are valid, open storage and process verify
  try {
    let hashDb = await storage.connectAsync()
    // retrieve the proof by hash_id_node
    let hashItem = await hashDb.findOneAsync({ _id: hashIdNode }, { proof: 1 })
    if (!hashItem || !hashItem.proof) throw new Error(`Cannot find proof for hash where hash_id_node = ${hashIdNode}`)
    let proofObj = null
    try {
      proofObj = cpb.binaryToObjectSync(hashItem.proof)
    } catch (err) {
      throw new Error(`Malformatted proof for hash where hash_id_node = ${hashIdNode}`)
    }

    let proofJSON = JSON.stringify(proofObj, null, 2)
    utils.log([proofJSON], false, quiet, json)
  } catch (error) {
    utils.log([`Show error: ${error.message}`], true, quiet, json)
  }
}

module.exports = {
  executeAsync: executeAsync
}
