const utils = require('./utils.js')
const storage = require('./storage.js')
const async = require('async')

function execute (yargs, argv) {
  // parameters are valid, open storage and process export
  async.waterfall([
    (wfCallback) => {
      storage.connect(wfCallback)
    },
    (hashDb, wfCallback) => {
      // retrieve all hashes from database
      hashDb.find({}, { _id: 1, cal: 1, eth: 1, btc: 1 }).sort({ createdAt: 1 }).exec((err, hashItems) => {
        if (err) return wfCallback(err)
        for (let x = 0; x < hashItems.length; x++) {
          let hashTime = utils.getHashIdTime(hashItems[x]._id)
          let proofStates = []
          if (hashItems[x].cal) proofStates.push('cal')
          if (hashItems[x].eth) proofStates.push('eth')
          if (hashItems[x].btc) proofStates.push('btc')
          let stateString = proofStates.join(', ')
          console.log(`${hashItems[x]._id} | ${hashTime} | ${stateString}`)
        }
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
