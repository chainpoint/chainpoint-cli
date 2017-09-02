const untildify = require('untildify')

const CONFIG_DIR = '~/.chainpoint'
const CONFIG_FILENAME = 'cli.config'

let configDir = untildify(CONFIG_DIR)
let configFilename = CONFIG_FILENAME

let pathToConfigFile = untildify(`${CONFIG_DIR}/${CONFIG_FILENAME}`)

module.exports = {
  configDir: configDir,
  configFilename: configFilename,
  pathToConfigFile: pathToConfigFile
}
