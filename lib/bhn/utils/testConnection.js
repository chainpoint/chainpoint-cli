const chalk = require('chalk')
const getInfo = require('./getInfo')

async function testConnection(options, checkSynced) {
  let message = await getInfo(options)
  if (message instanceof Error) {
    console.log(chalk.red('There was a problem reaching the bitcoin node:'), message.message)
    return false
  } else if (message && message.chain.progress < 1 && checkSynced) {
    console.log(
      chalk`{red Bitcoin node is not fully synced. Please wait until sync is complete:}
${+message.chain.progress.toFixed(6) * 100}% completed`
    )
    return false
  }

  return true
}

module.exports = testConnection
