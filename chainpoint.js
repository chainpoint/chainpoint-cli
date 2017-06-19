const _ = require('lodash')
const yargs = require('yargs')
const submitCmd = require('./lib/submit.js')
const updateCmd = require('./lib/update.js')
const verifyCmd = require('./lib/verify.js')
const importCmd = require('./lib/import.js')
const exportCmd = require('./lib/export.js')

let argv = yargs
  .usage('usage: $0 <command> [options] <argument>')
  .command('submit', 'submit a hash to be anchored', (yargs) => {
    let argv = yargs
      .usage('usage: submit <hash> ')
      .argv
    submitCmd.execute(yargs, argv)
  })
  .command('update', 'retrieve an updated proof for your hash(es), if available', (yargs) => {
    let argv = yargs
      .usage('usage: update <hash_id>')
      .argv
    updateCmd.execute(yargs, argv)
  })
  .command('verify', 'verify a proof\'s anchor claims', (yargs) => {
    let argv = yargs
      .usage('usage: verify <hash>')
      .argv
    verifyCmd.execute(yargs, argv)
  })
  .command('import', 'import a proof into the client db', (yargs) => {
    let argv = yargs
      .usage('usage: import --proof <file>')
      .option('p', {
        alias: 'proof',
        demandOption: true,
        requiresArg: true,
        type: 'string'
      })
      .argv
    importCmd.execute(yargs, argv)
  })
  .command('export', 'export a proof into the current directory', (yargs) => {
    let argv = yargs
      .usage('usage: export [options] <hash_id>')
      .option('b', {
        alias: 'binary',
        boolean: true
      })
      .argv
    exportCmd.execute(yargs, argv)
  })
  .demandCommand(1, 'You must specify a command to execute')
  .help('help')
  .argv

function parseCommand (yargs, argv) {
  if (argv._.length < 1) {
    yargs.showHelp()
  } else {
    // check for unknown command
    let command = _.lowerCase(argv._[0])
    if (_.indexOf(['submit', 'update', 'verify', 'import', 'export'], command) < 0) {
      console.log(`Unknown command - ${command}\n`)
      yargs.showHelp()
    }
  }
}

parseCommand(yargs, argv)
