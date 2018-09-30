/* Copyright 2017 Tierion
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*     http://www.apache.org/licenses/LICENSE-2.0
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

const utils = require('./utils.js')
const storage = require('./storage.js')
const OutputBuilder = require('./output-builder.js')

async function executeAsync(yargs, argv) {
  let output = new OutputBuilder('list')
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = argv.json || false

  // parameters are valid, open storage and process export
  try {
    let hashDb = await storage.connectAsync()
    // retrieve all hashes from database
    let hashItems = await hashDb.findAsync(
      {},
      { _id: 1, hash: 1, cal: 1, eth: 1, btc: 1 }
    )
    hashItems.sort(function(a, b) {
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
