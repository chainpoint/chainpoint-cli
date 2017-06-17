// load environment variables
const env = require('./parse-env.js')

const uuidValidate = require('uuid-validate')
const uuidTime = require('uuid-time')

function hashIsValid (hash) {
  return /^([a-fA-F0-9]{2}){20,64}$/.test(hash)
}

function hashIdIsValid (hashId) {
  return uuidValidate(hashId, 1)
}

function hashIdExpired (hashId) {
  let uuidEpoch = uuidTime.v1(hashId)
  var nowEpoch = new Date().getTime()
  let uuidDiff = nowEpoch - uuidEpoch
  let maxDiff = env.PROOF_EXPIRE_MINUTES * 60 * 1000
  return (uuidDiff > maxDiff)
}

module.exports = {
  hashIsValid: hashIsValid,
  hashIdIsValid: hashIdIsValid,
  hashIdExpired: hashIdExpired
}
