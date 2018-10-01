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

const OutputBuilder = require('./output-builder.js')
const { version } = require('../package.json')

async function executeAsync(yargs, argv) {
  let output = new OutputBuilder('version')
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = argv.json || false

  output.addSuccessResult({
    version: version
  })
  output.display(quiet, json)
}

module.exports = {
  executeAsync: executeAsync
}
