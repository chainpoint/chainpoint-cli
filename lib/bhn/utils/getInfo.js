const getClient = require('./getClient')

async function getInfo(options) {
  let client = getClient(options)
  try {
    let info = await client.getInfo()
    return info
  } catch (e) {
    let message = new Error(e.message)
    if (e.code === 'ENOTFOUND')
      message = new Error(
        `Problem connecting to bitcoin header node at ${client.host}:${
          client.port
        }: ${e.message}`
      )
    else if (e.code === 'ECONNREFUSED') {
      message = new Error(
        `No Bitcoin node found running at ${client.host}:${
          client.port
        }. Run \`chp bhn start\` to run one locally. `
      )
    }
    return message
  }
}

module.exports = getInfo
