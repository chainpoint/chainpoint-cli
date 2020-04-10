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

const utils = require('./lib/utils')
const _ = require('lodash')
const getStdin = require('get-stdin')
const yargs = require('yargs')

async function parseBaseUriAsync(baseUri) {
  // if the value supplied in --gateway-uri or in cli.config is invalid, exit
  if (!utils.isValidUrl(baseUri)) {
    console.error(`Invalid gateway uri - ${baseUri}`)
    process.exit(1)
  }

  // otherwise, return the valid value supplied with --gateway-uri or in cli.config as a one element array
  return baseUri
}

async function startAsync() {
  // load environment variables and commands
  const env = require('./lib/parse-env.js')
  const submitCmd = require('./lib/submit.js')
  const updateCmd = require('./lib/update.js')
  const verifyCmd = require('./lib/verify.js')
  const evaluateCmd = require('./lib/evaluate.js')
  const exportCmd = require('./lib/export.js')
  const listCmd = require('./lib/list.js')
  const showCmd = require('./lib/show.js')
  const deleteCmd = require('./lib/delete.js')
  const versionCmd = require('./lib/version.js')

  async function processArgsAsync() {
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
      .usage(
        'Usage: ' +
          require.main.filename
            .split('/')
            .pop()
            .slice(0, -3) +
          ' <command> [options] <argument>'
      )
      .option('g', {
        alias: 'gateway-uri',
        requiresArg: true,
        default: env.CHAINPOINT_GATEWAY_BASE_URI,
        description: 'specify uri of chainpoint gateway',
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
      .command('submit', 'submit a hash to be anchored (3x Nodes default)', async yargs => {
        let argv = yargs.usage('Usage: submit [options] (<hash> <hash>... | <hash>,<hash>,... )').string('_').argv
        argv.nodeUri = await parseBaseUriAsync(argv.nodeUri)
        submitCmd.executeAsync(yargs, argv)
      })
      .command('update', 'retrieve an updated proof for your hash(es), if available', async yargs => {
        let argv = yargs.usage('Usage: update [options] <proof_id>').option('a', {
          alias: 'all',
          demandOption: false,
          requiresArg: false,
          description: 'process all items in local database',
          type: 'boolean'
        }).argv
        updateCmd.executeAsync(yargs, argv)
      })
      .command('verify', "verify a proof's anchor claims", async yargs => {
        let argv = yargs.usage('Usage: verify [options] <proof_id>').option('a', {
          alias: 'all',
          demandOption: false,
          requiresArg: false,
          description: 'process all items in local database',
          type: 'boolean'
        }).argv
        verifyCmd.executeAsync(yargs, argv)
      })
      .command('evaluate', "evaluate and display a proof's anchor claims", async yargs => {
        let argv = yargs
          .usage('Usage: evaluate [options] <proof_id>')
          .option('a', {
            alias: 'all',
            demandOption: false,
            requiresArg: false,
            description: 'process all items in local database',
            type: 'boolean'
          })
          .option('b', {
            alias: 'btc',
            demandOption: false,
            requiresArg: false,
            description: 'get relevant bitcoin anchor tx information',
            type: 'boolean'
          }).argv
        evaluateCmd.executeAsync(yargs, argv)
      })
      .command('export', 'export a proof', async yargs => {
        let argv = yargs.usage('Usage: export [options] <proof_id>').option('b', {
          alias: 'binary',
          demandOption: false,
          requiresArg: false,
          description: 'use binary format',
          type: 'boolean'
        }).argv
        exportCmd.executeAsync(yargs, argv)
      })
      .command('list', 'display the status of every hash in the local database', yargs => {
        let argv = yargs.usage('Usage: list').argv
        listCmd.executeAsync(yargs, argv)
      })
      .command('show', 'show the proof for a proof_id', yargs => {
        let argv = yargs.usage('Usage: show [proof_id]').argv
        showCmd.executeAsync(yargs, argv)
      })
      .command('delete', 'delete a hash from the local database', yargs => {
        let argv = yargs.usage('Usage: delete <proof_id>').argv
        deleteCmd.executeAsync(yargs, argv)
      })
      .command('bhn', 'interact with a header node, either one running locally or remotely', yargs =>
        yargs
          .commandDir('lib/bhn')
          .usage('Usage: bhn <command> [options...]')
          .option('bhn-uri', {
            describe:
              'full uri of bitcoin header node. If no port is given, assumed default RPC port for Bitcoin Mainnet (8332)'
          })
          .option('bhn-api-key', {
            describe: 'api key if target node requires authentication'
          })
          .option('bhn-host', {
            describe: 'host of target bitcoin header node',
            default: 'localhost'
          })
          .option('bhn-port', {
            describe: 'port of target bitcoin header node if different from default bitcoin RPC port'
          })
          .option('bhn-network', {
            describe:
              'Bitcoin network the target node is running on. This option is useful if want to target default ports. (--network also works)',
            default: 'main'
          })
          .option('bhn-protocol', {
            describe: 'protocol where target bitcoin header node is running',
            default: 'http:'
          })
          .demandCommand(1, 'Must pass a command to run with bhn, e.g. chp bhn start')
          .help()
      )
      .command('version', 'show the CLI version', yargs => {
        let argv = yargs.usage('Usage: version').argv
        versionCmd.executeAsync(yargs, argv)
      })
      .demandCommand(1, 'You must specify a command.')
      .help('help', 'show help').argv

    // parse cli command and display error message on bad or missing command
    parseCommand(yargs, argv)
  }

  function parseCommand(yargs, argv) {
    if (argv._.length < 1) {
      yargs.showHelp()
    } else {
      // check for unknown command
      let command = _.lowerCase(argv._[0])
      if (
        _.indexOf(
          ['submit', 'update', 'verify', 'evaluate', 'export', 'list', 'show', 'delete', 'bhn', 'version'],
          command
        ) < 0
      ) {
        yargs.showHelp()
        console.error(`Unknown command: ${command}`)
      }
    }
  }

  // parse and process the command
  processArgsAsync()
}

module.exports = {
  startAsync: startAsync
}
