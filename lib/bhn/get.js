const chalk = require('chalk')
const getClient = require('./utils/getClient')
const testConnection = require('./utils/testConnection')

exports.command = 'get <block-height> [header node options...]'
exports.desc =
  'get the header for a block at a certai block. Must point to a running bhn server'
exports.builder = function(yargs) {
  yargs.positional('block-height', {
    type: 'number',
    describe: 'block height to retrieve header from'
  })
}
exports.handler = async function(argv) {
  let connection = await testConnection(argv)
  let { blockHeight } = argv
  // if nothing is returned then the node is unreachable
  if (!connection) return

  try {
    let client = getClient(argv)
    let header = await client.getBlock(blockHeight)
    if (!header) {
      console.log(
        chalk`{bgYellow Warning:} {bold No header available for block #${blockHeight}}.
Make sure your node is fully synced and the target block is not before the node's start height.`
      )
      return
    }
    console.log(`Header for block #${blockHeight}:`)
    console.log(header)
  } catch (e) {
    console.error(
      `Problem retrieving header for block ${blockHeight}:`,
      e.message
    )
  }
}
