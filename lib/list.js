const utils = require('./utils.js')
const storage = require('./storage.js')

async function executeAsync (yargs, argv) {
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = false // temp disabled // argv.json || false

  // parameters are valid, open storage and process export
  try {
    let hashDb = await storage.connectAsync()
    // retrieve all hashes from database
    let hashItems = await hashDb.findAsync({}, { _id: 1, hash: 1, cal: 1, eth: 1, btc: 1 })
    hashItems.sort(function (a, b) {
      return a.createdAt - b.createdAt
    })
    let items = []
    for (let x = 0; x < hashItems.length; x++) {
      let uuidTime = utils.getHashIdTime(hashItems[x]._id)
      let hashTime = new Date(uuidTime).toISOString()
      let proofStates = []
      if (hashItems[x].cal) proofStates.push('cal')
      if (hashItems[x].eth) proofStates.push('eth')
      if (hashItems[x].btc) proofStates.push('btc')
      let stateString = proofStates.join(', ')
      items.push(`${hashItems[x]._id} | ${hashTime} | ${hashItems[x].hash} | ${stateString}`)
    }
    utils.log(items, false, quiet, json)
  } catch (error) {
    utils.log([`List error: ${error.message}`], true, quiet, json)
  }
}

module.exports = {
  executeAsync: executeAsync
}
