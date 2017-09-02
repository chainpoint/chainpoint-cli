const uuidValidate = require('uuid-validate')
const uuidTime = require('uuid-time')
const fs = require('fs')
const cpb = require('chainpoint-binary')
const chpSchema = require('chainpoint-proof-json-schema')
const jmespath = require('jmespath')
const rp = require('request-promise-native')

function parseAnchorsComplete (proofObject) {
  // Because the minimum proof will contain a cal anchor, always start with cal
  let anchorsComplete = ['cal'].concat(jmespath.search(proofObject, '[branches[].branches[].ops[].anchors[].type] | [0]'))
  return anchorsComplete
}

function hashIsValid (hash) {
  return /^([a-fA-F0-9]{2}){20,64}$/.test(hash)
}

function hashIdIsValid (hashId) {
  return uuidValidate(hashId, 1)
}

function hashIdExpired (expMinutes, hashId) {
  let uuidEpoch = uuidTime.v1(hashId)
  var nowEpoch = new Date().getTime()
  let uuidDiff = nowEpoch - uuidEpoch
  let maxDiff = expMinutes * 60 * 1000
  return (uuidDiff > maxDiff)
}

function getHashIdTime (hashId) {
  return uuidTime.v1(hashId)
}

function fileExists (path) {
  return fs.existsSync(path)
}

function readFile (path, asBinary) {
  if (!fileExists(path)) return false
  let contents = null
  try {
    contents = fs.readFileSync(path, { encoding: asBinary ? null : 'utf8' })
  } catch (err) {
    console.error(err)
    return false
  }
  return contents
}

function writeFile (path, contents) {
  try {
    fs.writeFileSync(path, contents)
  } catch (err) {
    return false
  }
  return true
}

function readProofObject (proofFileData, asBinary) {
  let proofObject = null
  // test if data is a Buffer containing a proof in binary form
  if (asBinary) {
    try {
      proofObject = cpb.binaryToObjectSync(proofFileData)
    } catch (err) { }
    if (proofObject) return proofObject
    return null
  } else {
    // test if data is a JSON string
    let validProofObject = false
    try {
      proofObject = JSON.parse(proofFileData)
      validProofObject = chpSchema.validate(proofObject).valid
    } catch (err) { }
    if (validProofObject) return proofObject
  }

  return null
}

async function getStackConfigAsync (baseURI) {
  let options = {
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'GET',
    uri: baseURI + '/config',
    json: true,
    gzip: true,
    timeout: 1000,
    resolveWithFullResponse: true
  }
  try {
    let response = await rp(options)
    return response.body
  } catch (error) {
    throw new Error(`cannot get node config for ${baseURI}: ${error.message}`)
  }
}

module.exports = {
  parseAnchorsComplete: parseAnchorsComplete,
  hashIsValid: hashIsValid,
  hashIdIsValid: hashIdIsValid,
  hashIdExpired: hashIdExpired,
  fileExists: fileExists,
  readFile: readFile,
  writeFile: writeFile,
  readProofObject: readProofObject,
  getStackConfigAsync: getStackConfigAsync,
  getHashIdTime: getHashIdTime
}
