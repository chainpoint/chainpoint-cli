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

  // if nothing is returned then the node is unreachable
  if (!connection) return

  try {
    let client = getClient(argv)
    let header = await client.getBlock(argv.blockHeight)
    console.log(`Header for block #${argv.blockHeight}:`)
    console.log(header)
  } catch (e) {
    console.error(
      `Problem retrieving header for block ${argv.blockHeight}:`,
      e.message
    )
  }
}
