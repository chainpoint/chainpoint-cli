const utils = require('./utils.js')
const OutputBuilder = require('./output-builder.js')
const storage = require('./storage.js')
const cpb = require('chainpoint-binary')

async function executeAsync (yargs, argv) {
  let output = new OutputBuilder('import')
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = argv.json || false

  // check for valid filepath argument
  let filePath = argv.proof
  let isBinaryFile = filePath.endsWith('.chp')
  let isJSONFile = filePath.endsWith('.chp.json')
  if (!isBinaryFile && !isJSONFile) {
    output.addErrorResult({
      path: filePath,
      message: `unknown file type`
    })
    output.display(quiet, json)
    return
  }

  let proofFileData = utils.readFile(filePath, isBinaryFile)
  if (!proofFileData) {
    output.addErrorResult({
      path: filePath,
      message: `file not found`
    })
    output.display(quiet, json)
    return
  }

  // read proofData and get proof JSON object
  let proofObject = utils.readProofObject(proofFileData, isBinaryFile)
  if (!proofObject) {
    output.addErrorResult({
      path: filePath,
      message: `not valid chainpoint v3 data`
    })
    output.display(quiet, json)
    return
  }

  let forceImport = argv.force

  // parameters are valid, open storage and process submit
  try {
    let hashDb = await storage.connectAsync()
    // check to see if hashItem already exists, only import if --force
    let hashItem = await hashDb.findOneAsync({ _id: proofObject.hash_id_node })
    if (hashItem !== null && !forceImport) throw new Error('hash_id_node already exists, use--force to overwrite')

    let row = {}

    let anchorsComplete = utils.parseAnchorsComplete(proofObject)

    row._id = proofObject.hash_id_node
    row.hash = proofObject.hash
    row.cal = anchorsComplete.includes('cal')
    row.eth = anchorsComplete.includes('eth')
    row.btc = anchorsComplete.includes('btc')
    row.proof = cpb.objectToBase64Sync(proofObject)

    await hashDb.updateAsync({ _id: proofObject.hash_id_node }, row, { upsert: true })
    output.addSuccessResult({
      hash_id_node: proofObject.hash_id_node,
      hash: proofObject.hash,
      path: filePath,
      message: `imported`
    })
    output.display(quiet, json)
  } catch (error) {
    output.addErrorResult({
      path: filePath,
      message: `${error.message}`
    })
    output.display(quiet, json)
  }
}

module.exports = {
  executeAsync: executeAsync
}
