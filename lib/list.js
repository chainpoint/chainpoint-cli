const utils = require('./utils.js')
const storage = require('./storage.js')
const async = require('async')

function execute (yargs, argv) {
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = argv.json || false

  // parameters are valid, open storage and process export
  async.waterfall([
    (wfCallback) => {
      storage.connect(wfCallback)
    },
    (hashDb, wfCallback) => {
      // retrieve all hashes from database
      hashDb.find({}, { _id: 1, hash: 1, cal: 1, eth: 1, btc: 1 }).sort({ createdAt: 1 }).exec((err, hashItems) => {
        if (err) return wfCallback(err)
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
        return wfCallback(null)
      })
    }
  ], (err) => {
    if (err) utils.log([`List error: ${err.message}`], true, quiet, json)
  })
}

module.exports = {
  execute: execute
}
