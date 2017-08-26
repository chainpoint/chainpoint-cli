const utils = require('./utils.js')
const OutputBuilder = require('./output-builder.js')
const storage = require('./storage.js')

async function executeAsync (yargs, argv) {
  let output = new OutputBuilder('delete')
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = argv.json || false

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
  // parameters are valid, open storage and process verify
  try {
    let hashDb = await storage.connectAsync()
    let numRemoved = await hashDb.removeAsync({ _id: hashIdNode })
    if (numRemoved < 1) throw new Error('hash_id_node not found')
    output.addSuccessResult({
      hash_id_node: hashIdNode,
      message: `deleted`
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
