const NeDB = require('nedb')
const fs = require('fs')
const untildify = require('untildify')
const DATA_DIR = '~/.chainpoint'
const DATA_FILENAME = 'chainpoint.nedb'

function connect (callback) {
  // Ensure that the target directory exists
  if (!fs.existsSync(untildify(DATA_DIR))) {
    fs.mkdirSync(untildify(DATA_DIR))
  }

  let pathToDataFile = untildify(`${DATA_DIR}/${DATA_FILENAME}`)

  let hashDb = new NeDB({
    filename: pathToDataFile,
    timestampData: true,
    corruptAlertThreshold: 0
  })

  hashDb.loadDatabase((err) => {
    if (err) return callback(err)
    return callback(null, hashDb)
  })
}

module.exports = {
  connect: connect
}
