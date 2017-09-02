const envalid = require('envalid')
const config = require('./config.js')

let envDefinitions = {

  // ***********************************************************************
  // * Global variables with default values
  // ***********************************************************************

  // Chainpoint service location
  CHAINPOINT_NODE_API_BASE_URI: envalid.url({ desc: 'Base URI for the Chainpoint Node instance to consume' })

}

module.exports = envalid.cleanEnv(process.env, envDefinitions, {
  strict: true,
  dotEnvPath: config.pathToConfigFile
})
