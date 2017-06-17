const _ = require('lodash')
const yargs = require('yargs')
const submit = require('./lib/submit.js')
const update = require('./lib/update.js')
const verify = require('./lib/verify.js')

let argv = yargs
  .usage('usage: $0 <command> <argument>')
  .command('submit', 'submit a hash to be anchored', (yargs) => {
    let argv = yargs
      .usage('usage: submit <hash> ')
      .argv
    submit.execute(yargs, argv)
  })
  .command('update', 'retrieve an updated proof for your hash(es), if available', (yargs) => {
    let argv = yargs
      .usage('usage: update <hash_id>')
      .argv
    update.execute(yargs, argv)
  })
  .command('verify', 'verify a proof\'s anchor claims', (yargs) => {
    let argv = yargs
      .usage('usage: verify <hash>')
      .argv
    verify.execute(yargs, argv)
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
    if (_.indexOf(['submit', 'update', 'verify'], command) < 0) {
      console.log(`Unknown command - ${command}\n`)
      yargs.showHelp()
    }
  }
}

parseCommand(yargs, argv)
