const chalk = require('chalk')
const getConfig = require('./utils/getConfig')
const { HeaderNode } = require('headernode')

exports.command = 'start [header node options...]'
exports.desc = 'start a bitcoin header node locally'
exports.builder = {
  'start-height': {
    default: 337022,
    description: 'Height to start syncing your chain from.'
  },
  memory: {
    default: false,
    description: 'Run an in-memory bitcoin header node.'
  }
}
exports.handler = function(argv) {
  let config = getConfig(argv)
  console.log(
    chalk.bold(
      '\nYour about to start a new bitcoin header node with the following configs:'
    )
  )
  console.log(chalk`{cyan.bold Network:} ${config.str('network')}`)
  console.log(chalk`{cyan.bold URI:} ${config.str('uri')}`)
  console.log(chalk`{cyan.bold API Key:} ${Boolean(config.str('api-key'))}`)
  console.log(chalk`{cyan.bold Start Height:} ${config.int('start-height')}`)
  console.log(chalk`{cyan.bold Data Prefix:} ${config.getPrefix()}`)

  // Output some warnings before continuing
  console.log(chalk.bgRed('\nIMPORTANT:'))
  console.log(
    '- The node process is connected to your current terminal session \
which means syncing will stop if you exit this session. You can use a \
multiplexer like tmux to persist the node operations.'
  )
  console.log(
    `- If you would like to persist configs, such as API key, you can add them to a config file in ${config.getPrefix()}/bhn.conf`
  )
  console.log(
    chalk`- Once running, you can check the status of your node by running {bgWhite chp bhn info [...options]} in another terminal session
    `
  )
  // Get confirmation from user
  let userInput = process.openStdin()

  userInput.setEncoding('utf-8')
  process.stdout.write(
    chalk.cyan.bold('Would you like to start your node? (Y/n): ')
  )
  userInput.once('data', async data => {
    data = data
      .toString()
      .trim()
      .toLowerCase()
    if (data === 'yes' || data === 'y') {
      process.stdout.write(`Starting Bitcoin header node...\n`)
      await startNode(config)
    } else {
      process.stdout.write(
        chalk`Cancelling command {bgWhite chp bhn start}... \n`
      )
      process.exit()
    }
  })
}

async function startNode(config) {
  let node = new HeaderNode({
    // node options
    network: config.str('network'),
    memory: config.bool('memory', false),
    prefix: config.getPrefix(),
    logLevel: config.str('log-level', 'info'),
    // indexer options
    startTip: config.array('start-tip'),
    startHeight: config.int('start-height'),
    // pool options
    proxy: config.str('proxy'),
    onion: config.bool('onion'),
    upnp: config.bool('upnp'),
    seeds: config.array('seeds'),
    nodes: config.array('nodes'),
    listen: false,
    // http options
    ssl: config.bool('ssl'),
    keyFile: config.path('ssl-key'),
    certFile: config.path('ssl-cert'),
    host: config.str('http-host'),
    port: config.uint('http-port'),
    apiKey: config.str('api-key'),
    noAuth: config.bool('no-auth'),
    cors: config.bool('cors')
  })

  process.on('unhandledRejection', err => {
    throw err
  })

  process.on('SIGINT', async () => {
    if (node && node.opened) await node.close()
    process.exit()
  })

  try {
    await node.ensure()
    await node.open()
    await node.connect()
    await node.startSync()
  } catch (e) {
    console.error(e.stack)
    process.exit(1)
  }

  return node
}
