const envalid = require('envalid')
const untildify = require('untildify')
const fs = require('fs')
const utils = require('./utils')
const CONFIG_DIR = '~/.chainpoint'
const CONFIG_FILENAME = 'config'
const CHAINPOINT_API_BASE_URI_DEFAULT = 'http://127.0.0.1'

let pathToConfigFile = untildify(`${CONFIG_DIR}/${CONFIG_FILENAME}`)

let envDefinitions = {

  // ***********************************************************************
  // * Global variables with default values
  // ***********************************************************************

  // Chainpoint service location
  CHAINPOINT_API_BASE_URI: envalid.url({ default: CHAINPOINT_API_BASE_URI_DEFAULT, desc: 'Base URI for the Chainpoint services to consume' })

}

function initConfig () {
  // Ensure that the target directory exists
  if (!fs.existsSync(untildify(CONFIG_DIR))) {
    fs.mkdirSync(untildify(CONFIG_DIR))
  }
  // Ensure that the target file exists
  if (!fs.existsSync(untildify(pathToConfigFile))) {
    // it doesnt, so create it
    let content = `CHAINPOINT_API_BASE_URI=${CHAINPOINT_API_BASE_URI_DEFAULT}`
    utils.writeFile(pathToConfigFile, content)
  }
}

// create the configuration file if it does not already exist
initConfig()

module.exports = envalid.cleanEnv(process.env, envDefinitions, {
  strict: true,
  dotEnvPath: pathToConfigFile
})
