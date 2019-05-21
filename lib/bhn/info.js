const getInfo = require('./utils/getInfo')
const chalk = require('chalk')

exports.command = 'info [header node options...]'
exports.desc =
  'get info about a bitcoin header node. With no options set it will check locally and indicate if none is running'
exports.builder = function() {}
exports.handler = async function(argv) {
  let info = await getInfo(argv)
  if (info instanceof Error) console.log(chalk.red('There was a problem reaching the bitcoin node:'), info.message)
  else console.log(info)
}
