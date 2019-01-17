const nano = require("nano")(process.env.COUCHDB_URL)

let db_ok = false
const dbName = "urls"

exports.getDb = async function () {
  let bucket = nano.db.use(dbName)

  if (!db_ok) {
    try {
      await nano.db.create(dbName)
      console.log("Database created")
    } catch (err) {
      if (err.statusCode != 412) {
        throw err
      }
    }
    const indexDef = {
      index: { fields: [{ "requests": "desc" }] },
      name: 'requestsIndex'
    }
    try {
      await bucket.createIndex(indexDef)
      console.log("Index created")
    } catch (e) {
      console.error(e)
    }
    db_ok = true
  }
  return bucket
}