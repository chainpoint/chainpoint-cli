const _ = require('lodash')
const uuidValidate = require('uuid-validate')
const uuidTime = require('uuid-time')
const yargs = require('yargs')

// load all environment variables into env object
const env = require('./lib/parse-env.js')

let argv = yargs
  .usage('usage: $0 <command> [options] [arguments]')
  .command('submit', 'submit a hash to be anchored', function (yargs) {
    let argv = yargs
      .usage('usage: $0 submit [options] <hash>')
      .option('f', {
        alias: 'file',
        describe: 'hash a local file',
        type: 'string',
        requiresArg: true
      })
      .argv
    runSubmitCommand(yargs, argv)
  })
  .command('update', 'retrieve an updated proof for your hash(es), if available', function (yargs) {
    let argv = yargs
      .usage('usage: $0 update <hash_id>')
      .argv
    runUpdateCommand(yargs, argv)
  })
  .command('verify', 'verify a proof\'s anchor claims', function (yargs) {
    let argv = yargs
      .usage('usage: $0 verify <hash>')
      .argv
    runVerifyCommand(yargs, argv)
  })
  .help('help')
  .argv

function runSubmitCommand (yargs, argv) {
  // check for valid argument count
  if (argv._.length < 2) {
    yargs.showHelp()
    return
  }
  // check for valid argument value
  let hash = argv._[1]
  if (!hashIsValid(hash)) {
    console.log(`Invalid hash - ${hash}\n`)
    yargs.showHelp()
    return
  }
  // parameters are valid, process submit command
  console.log(`${hash} submitted`)
}

function runUpdateCommand (yargs, argv) {
  // check for valid argument count
  if (argv._.length < 2) {
    yargs.showHelp()
    return
  }
  // check for valid argument value
  let hashId = argv._[1]
  let isValidHashId = uuidValidate(hashId, 1)
  if (!isValidHashId) {
    console.log(`Invalid hash_id - ${hashId}\n`)
    yargs.showHelp()
    return
  }
  // check hash_id age for expiration
  if (hashIdExpired(hashId)) { // this hash has expired
    console.log(`Expired hash_id - ${hashId}\n`)
    return
  }
  // parameters are valid, process update command
  console.log(`${hashId} updated`)
}

function runVerifyCommand (yargs, argv) {
  // check for valid argument count
  if (argv._.length < 2) {
    yargs.showHelp()
    return
  }
  // check for valid argument value
  let hashId = argv._[1]
  let isValidHashId = uuidValidate(hashId, 1)
  if (!isValidHashId) {
    console.log(`Invalid hash_id - ${hashId}\n`)
    yargs.showHelp()
    return
  }
  // check hash_id age for expiration
  if (hashIdExpired(hashId)) { // this hash has expired
    console.log(`Expired hash_id - ${hashId}\n`)
    return
  }
  // parameters are valid, process update command
  console.log(`${hashId} verified`)
}

function hashIsValid (hash) {
  return /^([a-fA-F0-9]{2}){20,64}$/.test(hash)
}

function hashIdExpired (hashId) {
  let uuidEpoch = uuidTime.v1(hashId)
  var nowEpoch = new Date().getTime()
  let uuidDiff = nowEpoch - uuidEpoch
  let maxDiff = env.PROOF_EXPIRE_MINUTES * 60 * 1000
  return (uuidDiff > maxDiff)
}

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
