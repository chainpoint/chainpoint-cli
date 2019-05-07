const Config = require('bcfg')

module.exports = function getConfig(options = {}) {
  const config = new Config('bhn')
  config.inject({ prefix: '~/.chainpoint/bhn' })

  // options passed are actually argv parsed by yargs
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
