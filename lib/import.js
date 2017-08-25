const utils = require('./utils.js')
const storage = require('./storage.js')
const cpb = require('chainpoint-binary')

async function executeAsync (yargs, argv) {
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = false // temp disabled // argv.json || false

  // check for valid filepath argument
  let filePath = argv.proof
  let isBinaryFile = filePath.endsWith('.chp')
  let isJSONFile = filePath.endsWith('.chp.json')
  if (!isBinaryFile && !isJSONFile) {
    utils.log(['Import error: Unknown file type'], true, quiet, json)
    return
  }

  let proofFileData = utils.readFile(filePath, isBinaryFile)
  if (!proofFileData) {
    utils.log(['Import error: Cannot find file at that path'], true, quiet, json)
    return
  }

  // read proofData and get proof JSON object
  let proofObject = utils.readProofObject(proofFileData, isBinaryFile)
  if (!proofObject) {
    utils.log(['Import error: Not a valid Chainpoint v3 proof'], true, quiet, json)
    return
  }

  let forceImport = argv.force

  // parameters are valid, open storage and process submit
  try {
    let hashDb = await storage.connectAsync()
    // check to see if hashItem already exists, only import if --force
    let hashItem = await hashDb.findOneAsync({ _id: proofObject.hash_id_node })
    if (hashItem !== null && !forceImport) throw new Error('hash_id_node already exists, --force to overwrite')

    let row = {}

    let anchorsComplete = utils.parseAnchorsComplete(proofObject)

    row._id = proofObject.hash_id_node
    row.hash = proofObject.hash
    row.cal = anchorsComplete.includes('cal')
    row.eth = anchorsComplete.includes('eth')
    row.btc = anchorsComplete.includes('btc')
    row.proof = cpb.objectToBase64Sync(proofObject)

    await hashDb.updateAsync({ _id: proofObject.hash_id_node }, row, { upsert: true })
    utils.log([`${filePath} imported`], false, quiet, json)
  } catch (error) {
    utils.log([`Import error: ${error.message}`], true, quiet, json)
  }
}

module.exports = {
  executeAsync: executeAsync
}
