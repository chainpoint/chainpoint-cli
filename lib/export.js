// load environment variables
const env = require('./parse-env.js')

const utils = require('./utils.js')
const storage = require('./storage.js')
const cpb = require('chainpoint-binary')
const updateCmd = require('./update.js')
const OutputBuilder = require('./output-builder.js')

async function executeAsync (yargs, argv) {
  let output = new OutputBuilder('export')
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = argv.json || false

  // determine API base URI to use
  let baseURI = argv.server || env.CHAINPOINT_NODE_API_BASE_URI

  // check for valid argument value
  let hashIdNode = argv._[1]
  let isValidHashId = utils.hashIdIsValid(hashIdNode)
  if (!isValidHashId) {
    output.addErrorResult({
      hash_id_node: hashIdNode,
      message: `missing or invalid hash_id_node`
    })
    output.display(quiet, json)
    return
  }
  // parameters are valid, open storage and process export
  try {
    let stackConfig = await utils.getStackConfigAsync(baseURI)
    let hashDb = await storage.connectAsync()
    await updateCmd.updateHashesByHashIdNodeAsync(stackConfig, hashDb, [hashIdNode], baseURI)
    // retrieve the proof by hash_id_node
    let hashItem = await hashDb.findOneAsync({ _id: hashIdNode })
    if (!hashItem || !hashItem.proof) throw new Error(`Cannot find proof for hash where hash_id_node = ${hashIdNode}`)

    // save file
    let exportAsJSON = !argv.binary
    let filename = `${hashItem._id}.chp${exportAsJSON ? '.json' : ''}`
    let path = `./${filename}`
    let proofObj = null
    try {
      proofObj = cpb.binaryToObjectSync(hashItem.proof)
    } catch (err) {
      throw new Error(`Malformatted proof for hash where hash_id_node = ${hashIdNode}`)
    }
    let writeSuccess = false
    if (exportAsJSON) { // save the proof as a JSON string with extension .chp.json
      let proofJSON = JSON.stringify(proofObj, null, 2)
      writeSuccess = utils.writeFile(path, proofJSON)
    } else { // save the proof as binary data with extension .chp
      let proofBin = cpb.objectToBinarySync(proofObj)
      writeSuccess = utils.writeFile(path, proofBin)
    }
    if (!writeSuccess) throw new Error(`Cannot find proof for hash where hash_id_node = ${hashIdNode}`)

    output.addSuccessResult({
      hash_id_node: hashIdNode,
      filename: filename,
      message: `exported`
    })
    output.display(quiet, json)
  } catch (error) {
    output.addErrorResult({
      hash_id_node: hashIdNode,
      message: `${error.message}`
    })
    output.display(quiet, json)
  }
}

module.exports = {
  executeAsync: executeAsync
}
