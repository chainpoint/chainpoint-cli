const envalid = require('envalid')

let envDefinitions = {

  // ***********************************************************************
  // * Global variables with default values
  // ***********************************************************************

  // Chainpoint service location
  CHAINPOINT_API_BASE_URI: envalid.url({ default: 'http://127.0.0.1', desc: 'Base URI for the Chainpoint services to consume' })

}

module.exports = envalid.cleanEnv(process.env, envDefinitions, {
  strict: true,
  dotEnvPath: '~/.chainpoint/'
})
