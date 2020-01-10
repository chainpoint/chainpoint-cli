const getClient = require('./getClient')

async function getInfo(options) {
  let client = getClient(options)
  let uri = `${client.ssl ? 'https:' : 'http:'}//${client.host}:${client.port}`
  try {
    let info = await client.getInfo()
    return info
  } catch (e) {
    let message = new Error(e.message)
    if (e.code === 'ENOTFOUND') message = new Error(`Problem connecting to bitcoin header node at ${uri}: ${e.message}`)
    else if (e.code === 'ECONNREFUSED' && !e.message.includes('Unauthorized')) {
      message = new Error(`No Bitcoin node found running at ${uri}. Run \`chp bhn start\` to run one locally. `)
    }
    return message
  }
}

module.exports = getInfo
