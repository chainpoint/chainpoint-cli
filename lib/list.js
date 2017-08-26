const utils = require('./utils.js')
const storage = require('./storage.js')
const OutputBuilder = require('./output-builder.js')

async function executeAsync (yargs, argv) {
  let output = new OutputBuilder('list')
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = argv.json || false

  // parameters are valid, open storage and process export
  try {
    let hashDb = await storage.connectAsync()
    // retrieve all hashes from database
    let hashItems = await hashDb.findAsync({}, { _id: 1, hash: 1, cal: 1, eth: 1, btc: 1 })
    hashItems.sort(function (a, b) {
      return utils.getHashIdTime(a._id) - utils.getHashIdTime(b._id)
    })
    for (let x = 0; x < hashItems.length; x++) {
      let uuidTime = utils.getHashIdTime(hashItems[x]._id)
      let hashTime = new Date(uuidTime).toISOString()
      let proofStates = []
      if (hashItems[x].cal) proofStates.push('cal')
      if (hashItems[x].eth) proofStates.push('eth')
      if (hashItems[x].btc) proofStates.push('btc')
      output.addSuccessResult({
        hash_id_node: hashItems[x]._id,
        hash: hashItems[x].hash,
        timestamp: hashTime,
        anchors_complete: proofStates
      })
    }
    output.display(quiet, json)
  } catch (error) {
    output.addErrorResult({
      message: `${error.message}`
    })
    output.display(quiet, json)
  }
}

module.exports = {
  executeAsync: executeAsync
}
