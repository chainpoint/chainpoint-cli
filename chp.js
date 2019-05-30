#!/usr/bin/env node

/* Copyright 2017 Tierion
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *       http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const semver = require('semver')
const currentVersion = process.version
let runningValidVersion = semver.gt(currentVersion, '7.6.0')
if (!runningValidVersion) {
  console.error(`Chainpoint CLI requires Node v7.6.0 or higher, ${currentVersion} is currently in use`)
  process.exit(1)
}

const cli = require('./cli.js')

// start the whole show
cli.startAsync()
