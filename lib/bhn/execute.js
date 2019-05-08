const getClient = require('./utils/getClient')
const testConnection = require('./utils/testConnection')

exports.command = 'execute <method> [options..]'
exports.desc =
  'fire an arbitrary rpc method to the bitcoin header node. e.g. `chp bhn execute getpeerinfo`'
exports.builder = function(yargs) {
  yargs.positional('method', {
    type: 'string',
    describe:
      'rpc method to execute. subsequent strings are sent as arguments for the rpc method'
  })
}
exports.handler = async function(argv) {
  let connection = await testConnection(argv)
  let { method, options } = argv
  // if nothing is returned then the node is unreachable
  if (!connection) return

  try {
    let client = getClient(argv)
    let result = await client.execute(method, options)
    console.log('result:', result)
  } catch (e) {
    console.error(`Problem executing rpc method ${method}:`, e.message)
  }
}
