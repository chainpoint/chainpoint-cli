exports.command = 'stop [header node options...]'
exports.desc = 'stop a bitcoin header node'
exports.builder = function() {}
exports.handler = function(argv) {
  console.log('stopping a header node!')
}
