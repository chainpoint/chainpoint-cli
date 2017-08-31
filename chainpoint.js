#!/usr/bin/env node

// load environment variables
const env = require('./lib/parse-env.js')

const _ = require('lodash')
const yargs = require('yargs')
const submitCmd = require('./lib/submit.js')
const updateCmd = require('./lib/update.js')
const verifyCmd = require('./lib/verify.js')
const importCmd = require('./lib/import.js')
const exportCmd = require('./lib/export.js')
const listCmd = require('./lib/list.js')
const showCmd = require('./lib/show.js')
const deleteCmd = require('./lib/delete.js')
const versionCmd = require('./lib/version.js')
const getStdin = require('get-stdin')

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
    .command('import', 'import a proof', (yargs) => {
      let argv = yargs
        .usage('Usage: import --proof <file>')
        .option('p', {
          alias: 'proof',
          demandOption: true,
          requiresArg: true,
          description: 'read from proof file',
          type: 'string'
        })
        .option('f', {
          alias: 'force',
          demandOption: false,
          requiresArg: false,
          description: 'overwrite existing data',
          type: 'boolean'
        })
        .argv
      importCmd.executeAsync(yargs, argv)
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
        .usage('Usage: show <hash_id_node>')
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
    if (_.indexOf(['submit', 'update', 'verify', 'import', 'export', 'list', 'show', 'delete', 'version'], command) < 0) {
      yargs.showHelp()
      console.error(`Unknown command: ${command}`)
    }
  }
}

// parse and process the command
processArgsAsync()
