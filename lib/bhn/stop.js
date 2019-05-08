const getClient = require('./utils/getClient')
const testConnection = require('./utils/testConnection')

exports.command = 'stop [header node options...]'
exports.desc = 'stop a bitcoin header node'
exports.builder = function() {}
exports.handler = async function(argv) {
  let connection = await testConnection(argv)

  // if nothing is returned then the node is unreachable
  if (!connection) return

  try {
    let client = getClient(argv)
    console.log(
      `Stopping bitcoin header node at ${client.ssl ? 'https:' : 'http:'}//${
        client.host
      }:${client.port}...`
    )
    await client.execute('stop')
    console.log('Node is stopped.')
  } catch (e) {
    console.error('Problem stopping bitcoin header node:', e.message)
  }
}
