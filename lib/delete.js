const utils = require('./utils.js')
const storage = require('./storage.js')

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
    utils.log([`Delete error: Missing or invalid hash_id_node`], true, quiet, json)
    return
  }
  // parameters are valid, open storage and process verify
  try {
    let hashDb = await storage.connectAsync()
    let numRemoved = await hashDb.removeAsync({ _id: hashIdNode })
    if (numRemoved < 1) throw new Error(`Not Found : ${hashIdNode}`)
    utils.log([`${hashIdNode} : deleted`], false, quiet, json)
  } catch (error) {
    utils.log([`Delete error: ${error.message}`], true, quiet, json)
  }
}

module.exports = {
  executeAsync: executeAsync
}
