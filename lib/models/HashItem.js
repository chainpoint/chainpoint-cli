const Sequelize = require('sequelize')
const fs = require('fs')
const untildify = require('untildify')

const SQLITE_DIR = '~/.chainpoint'
const SQLITE_FILENAME = 'chainpoint.sqlite'
const SQLITE_DB_NAME = 'chainpoint'
const SQLITE_DB_USER = 'chainpoint'
const SQLITE_DB_PASS = ''
const SQLITE_TABLE_NAME = 'chainpoint_hashes'

// Ensure that the target directory exists
if (!fs.existsSync(untildify(SQLITE_DIR))) {
  fs.mkdirSync(untildify(SQLITE_DIR))
}

// Connect to Sqlite through Sequelize.
const sequelize = new Sequelize(SQLITE_DB_NAME, SQLITE_DB_USER, SQLITE_DB_PASS, {
  dialect: 'sqlite',
  logging: false,
  storage: untildify(`${SQLITE_DIR}/${SQLITE_FILENAME}`)
})

// Define the model and the table it will be stored in.
var HashItem = sequelize.define(SQLITE_TABLE_NAME,
  {
    hashId: {
      comment: 'The hash uniqiue idenifier',
      primaryKey: true,
      type: Sequelize.STRING,
      validate: {
        is: ['^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$', 'i']
      },
      field: 'hash_id',
      allowNull: false,
      unique: true
    },
    context: {
      comment: 'The hash context information, such as a path to a file',
      type: Sequelize.STRING
    },
    description: {
      comment: 'The hash general description',
      type: Sequelize.STRING
    },
    hash: {
      comment: 'The hash in hexadecimal form',
      type: Sequelize.STRING,
      validate: {
        is: ['^([a-fA-F0-9]{2}){20,64}$', 'i']
      },
      allowNull: false
    },
    cal: {
      comment: 'Boolean indicating whether or not a proof with a calendar anchor has been received for this hash',
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
    eth: {
      comment: 'Boolean indicating whether or not a proof with an eth anchor has been received for this hash',
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
    btc: {
      comment: 'Boolean indicating whether or not a proof with a btc anchor has been received for this hash',
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
    proof: {
      comment: 'The most recent proof received for this hash',
      type: Sequelize.STRING
    }
  },
  {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: false,
    // Disable the modification of table names; By default, sequelize will automatically
    // transform all passed model names (first parameter of define) into plural.
    // if you don't want that, set the following
    freezeTableName: true
  }
)

module.exports = {
  sequelize: sequelize,
  HashItem: HashItem
}
