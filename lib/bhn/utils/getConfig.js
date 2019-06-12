const Config = require('bcfg')

module.exports = function getConfig(_options = {}) {
  const config = new Config('bhn')
  config.inject({ prefix: '~/.chainpoint/bhn' })
  // options passed are actually argv parsed by yargs
  // but we need to get the bhn specific args but with the `bhn-` prefix parsed out
  const options = parseBhnArgv(_options)
  config.inject(options)
  config.load({
    // Parse URL hash
    hash: true,
    // Parse querystring
    query: true,
    // Parse environment
    env: true
  })

  // Will parse [PREFIX]/bhn.conf (throws on FS error).
  // PREFIX is set above to `~/.chainpoint/bhn`
  // can change the prefix by passing in a `prefix` option
  config.open('bhn.conf')
  return config
}

// utility function for parsing argvs and returning bhn options but without
// the `bhn-` prefix
function parseBhnArgv(argv) {
  const options = {}
  const prefix = 'bhn-'
  for (let arg in argv) {
    if (arg.includes(prefix)) {
      let key = arg.slice(prefix.length)
      options[key] = argv[arg]
    }
  }

  // network argument should override since bhnNetwork
  // gets default set to `main`
  if (argv.network) options.network = argv.network
  return options
}
