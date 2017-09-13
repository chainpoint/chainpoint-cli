#!/usr/bin/env node

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

const fs = require('fs')
const utils = require('./lib/utils')
const { promisify } = require('util')
const dns = require('dns')
const rp = require('request-promise-native')
const _ = require('lodash')
const getStdin = require('get-stdin')
const yargs = require('yargs')
const config = require('./lib/config.js')

async function discoverCoresAsync () {
  let resolveTxtAsync = promisify(dns.resolveTxt)

  // retrieve Core URI txt entries from chainpoint.org DNS
  let hosts
  try {
    hosts = await resolveTxtAsync('_core.addr.chainpoint.org')
  } catch (error) {
    throw new Error(`Could not query chainpoint.org DNS : ${error.message}`)
  }
  if (hosts.length === 0) throw new Error('Unable to discover a Core instance')

  // convert results to single dimension array
  let coreBaseURIs = hosts.map((hostArray) => {
    return hostArray[0]
  })

  // randomize order and return
  return _.shuffle(coreBaseURIs)
}

async function discoverRandomNodeAsync (coreBaseURIs) {
  let nodeBaseURI
  for (let x = 0; x < coreBaseURIs.length; x++) {
    let options = {
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'GET',
      uri: `http://${coreBaseURIs[x]}/nodes/random`,
      json: true,
      gzip: true,
      timeout: 1000,
      resolveWithFullResponse: true
    }
    try {
      let response = await rp(options)
      let randomNodes = response.body
      if (randomNodes.length > 0) {
        // assign nodeBaseURI and return
        nodeBaseURI = randomNodes[0].public_uri
        break
      }
    } catch (error) {
      continue
    }
  }
  if (!nodeBaseURI) throw new Error('Unable to discover a random Node instance')

  return nodeBaseURI
}

async function initConfigAsync () {
  // Ensure that the target directory exists
  if (!fs.existsSync(config.configDir)) {
    fs.mkdirSync(config.configDir)
  }
  // Ensure that the target file exists
  if (!fs.existsSync(config.pathToConfigFile)) {
    // it doesnt, so discover Node URI to use and create the file
    try {
      let coreBaseURIs = await discoverCoresAsync()
      let nodeBaseURI = await discoverRandomNodeAsync(coreBaseURIs)

      let content = `CHAINPOINT_NODE_API_BASE_URI=${nodeBaseURI}`
      utils.writeFile(config.pathToConfigFile, content)
    } catch (error) {
      console.error(error.message)
      process.exit(1)
    }
  }
}

async function startAsync () {
  // create the configuration file if it does not already exist
  try {
    await initConfigAsync()
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }

  // load environment variables and commands
  const env = require('./lib/parse-env.js')
  const submitCmd = require('./lib/submit.js')
  const updateCmd = require('./lib/update.js')
  const verifyCmd = require('./lib/verify.js')
  const exportCmd = require('./lib/export.js')
  const listCmd = require('./lib/list.js')
  const showCmd = require('./lib/show.js')
  const deleteCmd = require('./lib/delete.js')
  const versionCmd = require('./lib/version.js')

  async function processArgsAsync () {
    let input
    try {
      let inputItems = []
      input = await getStdin()
      if (input) {
        inputItems = input.trim().split(' ')
        yargs.parse(inputItems)
      }
    } catch (error) {
      yargs.showHelp()
      console.error(`Error reading from stdin: ${input}`)
    }

    let argv = yargs
      .usage('Usage: ' + require.main.filename.split('/').pop().slice(0, -3) + ' <command> [options] <argument>')
      .option('s', {
        alias: 'server',
        requiresArg: true,
        default: env.CHAINPOINT_NODE_API_BASE_URI,
        description: 'specify server to use',
        type: 'string'
      })
      .option('q', {
        alias: 'quiet',
        demandOption: false,
        requiresArg: false,
        description: 'suppress all non-error output',
        type: 'boolean'
      })
      .option('j', {
        alias: 'json',
        demandOption: false,
        requiresArg: false,
        description: 'format all output as json',
        type: 'boolean'
      })
      .command('submit', 'submit a hash to be anchored', (yargs) => {
        let argv = yargs
          .usage('Usage: submit [options] (<hash> <hash>... | <hash>,<hash>,... )')
          .string('_')
          .argv
        submitCmd.executeAsync(yargs, argv)
      })
      .command('update', 'retrieve an updated proof for your hash(es), if available', (yargs) => {
        let argv = yargs
          .usage('Usage: update [options] <hash_id_node>')
          .option('a', {
            alias: 'all',
            demandOption: false,
            requiresArg: false,
            description: 'process all items in local database',
            type: 'boolean'
          })
          .argv
        updateCmd.executeAsync(yargs, argv)
      })
      .command('verify', 'verify a proof\'s anchor claims', (yargs) => {
        let argv = yargs
          .usage('Usage: verify [options] <hash_id_node>')
          .option('a', {
            alias: 'all',
            demandOption: false,
            requiresArg: false,
            description: 'process all items in local database',
            type: 'boolean'
          })
          .argv
        verifyCmd.executeAsync(yargs, argv)
      })
      .command('export', 'export a proof', (yargs) => {
        let argv = yargs
          .usage('Usage: export [options] <hash_id_node>')
          .option('b', {
            alias: 'binary',
            demandOption: false,
            requiresArg: false,
            description: 'use binary format',
            type: 'boolean'
          })
          .argv
        exportCmd.executeAsync(yargs, argv)
      })
      .command('list', 'display the status of every hash in the local database', (yargs) => {
        let argv = yargs
          .usage('Usage: list')
          .argv
        listCmd.executeAsync(yargs, argv)
      })
      .command('show', 'show the proof for a hash_id_node', (yargs) => {
        let argv = yargs
          .usage('Usage: show [hash_id_node]')
          .argv
        showCmd.executeAsync(yargs, argv)
      })
      .command('delete', 'delete a hash from the local database', (yargs) => {
        let argv = yargs
          .usage('Usage: delete <hash_id_node>')
          .argv
        deleteCmd.executeAsync(yargs, argv)
      })
      .command('version', 'show the CLI version', (yargs) => {
        let argv = yargs
          .usage('Usage: version')
          .argv
        versionCmd.executeAsync(yargs, argv)
      })
      .demandCommand(1, 'You must specify a command.')
      .help('help', 'show help')
      .argv

    // parse cli command and display error message on bad or missing command
    parseCommand(yargs, argv)
  }

  function parseCommand (yargs, argv) {
    if (argv._.length < 1) {
      yargs.showHelp()
    } else {
      // check for unknown command
      let command = _.lowerCase(argv._[0])
      if (_.indexOf(['submit', 'update', 'verify', 'export', 'list', 'show', 'delete', 'version'], command) < 0) {
        yargs.showHelp()
        console.error(`Unknown command: ${command}`)
      }
    }
  }

  // parse and process the command
  processArgsAsync()
}

// start the whole show
startAsync()
