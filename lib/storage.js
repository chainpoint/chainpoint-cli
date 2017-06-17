const HashItem = require('./models/HashItem.js').HashItem

function connect (callback) {
  HashItem.sequelize.sync().then(() => {
    // all assertions made successfully, return success
    return callback(null)
  }).catch((err) => {
    // an error has occurred with a table assertion, return error
    return callback(err)
  })
}

module.exports = {
  connect: connect
}
