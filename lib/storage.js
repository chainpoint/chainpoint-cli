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

const NeDB = require('nedb')
const fs = require('bfile')
const untildify = require('untildify')
const DATA_DIR = '~/.chainpoint/cli'
const DATA_FILENAME = 'chainpoint-v4-proofs.db'
const bluebird = require('bluebird')

async function connectAsync() {
  // Ensure that the target directory exists
  if (!fs.existsSync(untildify(DATA_DIR))) {
    fs.mkdirpSync(untildify(DATA_DIR))
  }

  let pathToDataFile = untildify(`${DATA_DIR}/${DATA_FILENAME}`)

  let hashDb = new NeDB({
    filename: pathToDataFile,
    timestampData: true,
    corruptAlertThreshold: 0
  })
  bluebird.promisifyAll(hashDb)

  await hashDb.loadDatabaseAsync()

  return hashDb
}

module.exports = {
  connectAsync: connectAsync
}
