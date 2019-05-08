const chalk = require('chalk')
const getInfo = require('./getInfo')

async function testConnection(options) {
  let message = await getInfo(options)
  if (message instanceof Error) {
    console.log(
      chalk.red('There was a problem reaching the bitcoin node:'),
      message.message
    )
    return false
  }

  return true
}

module.exports = testConnection
