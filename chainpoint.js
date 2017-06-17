const _ = require('lodash')
const uuidValidate = require('uuid-validate')
const uuidTime = require('uuid-time')
const yargs = require('yargs')
const request = require('request')
const async = require('async')
const cpb = require('chainpoint-binary')

// load all environment variables into env object
const env = require('./lib/parse-env.js')
const HashItem = require('./lib/models/HashItem.js').HashItem

let argv = yargs
  .usage('usage: $0 <command> <argument>')
  .command('submit', 'submit a hash to be anchored', function (yargs) {
    let argv = yargs
      .usage('usage: submit <hash> ')
      .argv
    runSubmitCommand(yargs, argv)
  })
  .command('update', 'retrieve an updated proof for your hash(es), if available', function (yargs) {
    let argv = yargs
      .usage('usage: update <hash_id>')
      .argv
    runUpdateCommand(yargs, argv)
  })
  .command('verify', 'verify a proof\'s anchor claims', function (yargs) {
    let argv = yargs
      .usage('usage: verify <hash>')
      .argv
    runVerifyCommand(yargs, argv)
  })
  .demandCommand(1, 'You must specify a command to execute')
  .help('help')
  .argv

function runSubmitCommand (yargs, argv) {
  // check for hash argument
  let hash = argv._[1]
  if (!hashIsValid(hash)) {
    yargs.showHelp()
    console.log('Missing or invalid hash \n')
    return
  }

  HashItem.sequelize.sync().then(() => {
    submitHashes([hash])
  }).catch((err) => {
    console.error(`HashItem submit error: ${err.message} : ${err.stack}`)
  })
}

function submitHashes (hashArray) {
  let options = {
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST',
    uri: env.CHAINPOINT_API_BASE_URI + '/hashes',
    body: { hashes: hashArray },
    json: true,
    gzip: true
  }
  request(options, function (err, response, body) {
    if (err) {
      console.error(err)
      return
    }
    if (response.statusCode !== 200) {
      console.error(response.body.message)
      return
    }

    async.each(body.hashes, function (hashItem, eachCallback) {
      let now = Date.now()
      let row = {}
      row.hashId = hashItem.hash_id
      row.hash = hashItem.hash
      row.createdAt = now
      row.updatedAt = now

      HashItem.create(row)
        .then((newRow) => {
          let hashItem = newRow.get({ plain: true })
          console.log(`${hashItem.hash} submitted and assigned a hash_id of ${hashItem.hashId}`)
          return eachCallback(null)
        }).catch(err => {
          return eachCallback(`HashItem submit error: ${err.message} : ${err.stack}`)
        })
    }, function (err) {
      if (err) {
        console.error(err)
      }
    })
  })
}

function runUpdateCommand (yargs, argv) {
  // check for argument
  let hasArgument = argv._.length > 1
  if (hasArgument) {
    // check for valid argument value
    let hashId = argv._[1]
    let isValidHashId = uuidValidate(hashId, 1)
    if (!isValidHashId) {
      yargs.showHelp()
      console.log(`Invalid hash_id - ${hashId}\n`)
      return
    }
    // check hash_id age for expiration
    if (hashIdExpired(hashId)) { // this hash has expired
      console.log(`Expired hash_id - ${hashId}\n`)
      return
    }
    // parameters are valid, process update command
    HashItem.sequelize.sync().then(() => {
      updateHashesByHashId([hashId])
    }).catch((err) => {
      console.error(`HashItem update error: ${err.message} : ${err.stack}`)
    })
  } else {
    // process hashes from local storage
    HashItem.sequelize.sync().then(() => {
      // retrieve hash_ids
      HashItem.findAll({ attributes: ['hashId'] })
        .then((hashItems) => {
          // get hashId array
          let hashIds = hashItems.map((hashItem) => {
            return hashItem.hashId
          })
          // filter out those older than PROOF_EXPIRE_MINUTES
          hashIds = hashIds.filter((hashId) => {
            return !hashIdExpired(hashId)
          })
          // TODO: Account for max proofs per request to API
          // retrieve latest proofs
          updateHashesByHashId(hashIds)
        })
    }).catch((err) => {
      console.error(`HashItem update error: ${err.message} : ${err.stack}`)
    })
  }
}

function updateHashesByHashId (hashIdArray) {
  let hashIdCSV = hashIdArray.join(',')
  let options = {
    headers: {
      'Content-Type': 'application/json',
      hashids: hashIdCSV
    },
    method: 'GET',
    uri: env.CHAINPOINT_API_BASE_URI + '/proofs',
    json: true,
    gzip: true
  }
  request(options, function (err, response, body) {
    if (err) {
      console.error(err)
      return
    }
    if (response.statusCode !== 200) {
      console.error(response.body.message)
      return
    }

    async.each(body, function (hashItem, eachCallback) {
      if (hashItem.proof === null) {
        console.log(`${hashItem.hash_id} has no proof data`)
        return eachCallback(null)
      } else {
        cpb.binaryToObject(hashItem.proof, function (err, proofObject) {
          if (err) {
            console.log(`Could not parse proof for hash_id ${hashItem.hash_id}`)
            return eachCallback(null)
          } else {
            let updateData = {}
            updateData.cal = true // if we've gotten this far, the cal branch must  at least exist
            let afterCalBranches = proofObject.branches[0].branches
            _.each(afterCalBranches, (branch) => {
              let anchorType = branch.ops[branch.ops.length - 1].anchors[0].type
              switch (anchorType) {
                case 'eth':
                  updateData.eth = true
                  break
                case 'btc':
                  updateData.btc = true
                  break
              }
            })
            updateData.proof = hashItem.proof

            HashItem.update(updateData, { where: { hashId: hashItem.hash_id } })
              .then((result) => {
                console.log(`${hashItem.hash_id} updated with latest proof data`)
                return eachCallback(null)
              }).catch(err => {
                return eachCallback(`HashItem update error: ${err.message} : ${err.stack}`)
              })
          }
        })
      }
    }, function (err) {
      if (err) {
        console.error(err)
      }
    })
  })
}

function runVerifyCommand (yargs, argv) {
  // check for valid argument value
  let hashId = argv._[1]
  let isValidHashId = uuidValidate(hashId, 1)
  if (!isValidHashId) {
    yargs.showHelp()
    console.log(`Missing or invalid hash_id \n`)
    return
  }
  // parameters are valid, process update command
  HashItem.sequelize.sync().then(() => {
    // retrieve the proof by hash_id
    HashItem.find({ where: { hashId: hashId } }).then((hashItem) => {
      if (!hashItem) {
        console.log(`Cannot find proof for hash ${hashId} \n`)
        return
      }
      // run verification on proof
      verifyProofs([hashItem.proof])
    })
  }).catch((err) => {
    console.error(`HashItem update error: ${err.message} : ${err.stack}`)
  })
}

function verifyProofs (proofArray) {
  let options = {
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST',
    uri: env.CHAINPOINT_API_BASE_URI + '/verify',
    body: { proofs: proofArray },
    json: true,
    gzip: true
  }
  request(options, function (err, response, body) {
    if (err) {
      console.error(err)
      return
    }
    if (response.statusCode !== 200) {
      console.error(response.body.message)
      return
    }
    _.each(body, (proof) => {
      console.log(`Proof for hash_id ${proof.hash_id || '(not found)'} is ${proof.status} `)
    })
  })
}

function hashIsValid (hash) {
  return /^([a-fA-F0-9]{2}){20,64}$/.test(hash)
}

function hashIdExpired (hashId) {
  let uuidEpoch = uuidTime.v1(hashId)
  var nowEpoch = new Date().getTime()
  let uuidDiff = nowEpoch - uuidEpoch
  let maxDiff = env.PROOF_EXPIRE_MINUTES * 60 * 1000
  return (uuidDiff > maxDiff)
}

function parseCommand (yargs, argv) {
  if (argv._.length < 1) {
    yargs.showHelp()
  } else {
    // check for unknown command
    let command = _.lowerCase(argv._[0])
    if (_.indexOf(['submit', 'update', 'verify'], command) < 0) {
      console.log(`Unknown command - ${command}\n`)
      yargs.showHelp()
    }
  }
}

parseCommand(yargs, argv)
