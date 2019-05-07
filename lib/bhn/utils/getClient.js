const { parse } = require('url')
const { NodeClient } = require('bclient')
const { Network } = require('bcoin')
const assert = require('bsert')

const getConfig = require('./getConfig')

module.exports = function(options = {}) {
  let config = getConfig(options)

  let url = config.str('uri')
  let network = Network.get(config.str('network', 'main'))
  let host, port, protocol

  // "Smart" assemble the client connection options
  // based on the configs passed.
  if (!url) {
    host = config.str('host', '127.0.0.1')
    port = config.str('port', network.rpcPort)
    protocol = config.str('protocol', 'http:')
    if (config.str('ssl')) protocol = 'https:'
    url = `${protocol}//${host}:${port}`
  }

  // sanity checks on the url format
  let parsedUrl = parse(url)
  assert(
    typeof parsedUrl.host === 'string',
    'Malformed url. Expected a host string'
  )
  assert(
    parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:',
    'Malformed url. Expected a protocol of http: or https:'
  )
  assert(parsedUrl.port, 'Malformed url. Expected a port number')

  return new NodeClient({
    url,
    apiKey: config.str('api-key')
  })
}
