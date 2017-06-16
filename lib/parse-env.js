const envalid = require('envalid')

let envDefinitions = {

  // ***********************************************************************
  // * Global variables with default values
  // ***********************************************************************

  // Proof retention setting
  PROOF_EXPIRE_MINUTES: envalid.num({ default: 1440, desc: 'The lifespan of stored proofs, in minutes' })

}

module.exports = envalid.cleanEnv(process.env, envDefinitions, {
  strict: true
})
