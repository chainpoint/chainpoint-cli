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

class OutputBuilder {
  constructor(commandName) {
    this.output = {}
    this.output.command = commandName
    this.output.result_count = 0
    this.output.error_count = 0
    this.output.results = []
  }

  addSuccessResult(item) {
    let result = { success: true }
    for (let key in item) {
      result[key] = item[key]
    }
    this.output.result_count++
    this.output.results.push(result)
  }

  addErrorResult(item) {
    let result = { success: false }
    for (let key in item) {
      result[key] = item[key]
    }
    this.output.result_count++
    this.output.error_count++
    this.output.results.push(result)
  }

  display(quiet, json) {
    if (!quiet) {
      if (json) {
        console.log(JSON.stringify(this.output))
      } else {
        for (let x = 0; x < this.output.results.length; x++) {
          let lineData = []
          for (let key in this.output.results[x]) {
            if (key === 'success') continue
            if (
              key === 'anchors_invalid' &&
              this.output.results[x][key].length === 0
            )
              continue
            if (key === 'proof')
              this.output.results[x][key] = JSON.stringify(
                this.output.results[x][key]
              )
            lineData.push(this.output.results[x][key])
          }
          console.log(lineData.join(' | '))
        }
      }
    }
  }
}

module.exports = OutputBuilder
