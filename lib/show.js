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
const OutputBuilder = require('./output-builder.js')
const storage = require('./storage.js')
const cpb = require('chainpoint-binary')

async function executeAsync(yargs, argv) {
  let output = new OutputBuilder('show')
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = argv.json || false

  // check for valid argument value
  let hasHashIdArg = false
  let hashIdNode
  if (argv._[1]) {
    hashIdNode = argv._[1]
    let isValidHashId = utils.hashIdIsValid(hashIdNode)
    if (!isValidHashId) {
      output.addErrorResult({
        hash_id_node: hashIdNode,
        message: `invalid hash_id_node`
      })
      output.display(quiet, json)
      return
    }
    hasHashIdArg = true
  }
  // open storage and process verify
  try {
    let hashDb = await storage.connectAsync()
    let hashItems = []
    if (hasHashIdArg) {
      let hashItem = await hashDb.findOneAsync(
        { _id: hashIdNode },
        { proof: 1 }
      )
      if (!hashItem || !hashItem.proof) throw new Error('proof data not found')
      hashItems.push(hashItem)
    } else {
      hashItems = await hashDb.findAsync({}, { proof: 1 })
    }

    for (let x = 0; x < hashItems.length; x++) {
      let proofObj = null
      // if there is no proof for this hashItem yet, skip when displaying all
      if (!hashItems[x].proof) continue
      try {
        proofObj = cpb.binaryToObjectSync(hashItems[x].proof)
        let proofJSON = JSON.stringify(proofObj, null, 2)
        output.addSuccessResult({
          proof: JSON.parse(proofJSON)
        })
      } catch (error) {
        output.addErrorResult({
          hash_id_node: hashIdNode,
          message: 'bad proof data'
        })
      }
    }

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
