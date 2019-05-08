exports.command = 'start [header node options...]'
exports.desc = 'start a bitcoin header node locally'
exports.builder = function() {}
exports.handler = function(argv) {
  console.log('starting a header node!')
}
