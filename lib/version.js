const utils = require('./utils.js')
const {version} = require('../package.json')

function execute (yargs, argv) {
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = argv.json || false

  utils.log([`${version}`], false, quiet, json)
}

module.exports = {
  execute: execute
}
