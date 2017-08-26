const OutputBuilder = require('./output-builder.js')
const {version} = require('../package.json')

async function executeAsync (yargs, argv) {
  let output = new OutputBuilder('version')
  // honor the quiet directive if set
  let quiet = argv.quiet || false
  // honor the json directive if set
  let json = argv.json || false

  output.addSuccessResult({
    version: version
  })
  output.display(quiet, json)
}

module.exports = {
  executeAsync: executeAsync
}
