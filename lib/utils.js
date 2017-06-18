// load environment variables
const env = require('./parse-env.js')

const uuidValidate = require('uuid-validate')
const uuidTime = require('uuid-time')
const fs = require('fs')
const cpb = require('chainpoint-binary')

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

function fileExists (path) {
  return fs.existsSync(path)
}

function readFile (path) {
  if (!fileExists(path)) return false
  let contents = null
  try {
    contents = fs.readFileSync(path, 'utf8')
  } catch (err) {
    return false
  }
  return contents
}

function interpretProof (proofDataString) {
  let proofBase64 = null
  try {
    proofBase64 = cpb.objectToBase64Sync(proofDataString)
  } catch (err) { }
  if (proofBase64) return proofBase64
  let proofObject = null
  try {
    proofObject = cpb.binaryToObjectSync(proofDataString)
  } catch (err) { }
  if (proofObject) return proofDataString
  return null
}

module.exports = {
  hashIsValid: hashIsValid,
  hashIdIsValid: hashIdIsValid,
  hashIdExpired: hashIdExpired,
  fileExists: fileExists,
  readFile: readFile,
  interpretProof: interpretProof
}
