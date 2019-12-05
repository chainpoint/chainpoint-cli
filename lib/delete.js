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

async function executeAsync(yargs, argv) {
  let output = new OutputBuilder('delete')
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = argv.json || false

  // check for valid argument value
  let proofId = argv._[1]
  let isValidHashId = utils.hashIdIsValid(proofId)
  if (!isValidHashId) {
    output.addErrorResult({
      proof_id: proofId,
      message: `missing or invalid proof_id`
    })
    output.display(quiet, json)
    return
  }
  // parameters are valid, open storage and process verify
  try {
    let hashDb = await storage.connectAsync()
    let numRemoved = await hashDb.removeAsync({ _id: proofId })
    if (numRemoved < 1) throw new Error('proof_id not found')
    output.addSuccessResult({
      proof_id: proofId,
      message: `deleted`
    })
    output.display(quiet, json)
  } catch (error) {
    output.addErrorResult({
      proof_id: proofId,
      message: `${error.message}`
    })
    output.display(quiet, json)
  }
}

module.exports = {
  executeAsync: executeAsync
}
