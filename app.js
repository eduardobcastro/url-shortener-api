const nano = require("nano")(process.env.COUCHDB_URL)
  ,express = require("express")
  ,expressGraphQL = require("express-graphql")
  ,buildSchema = require("graphql").buildSchema
  ,cors = require("cors")
  ,crypto = require('crypto')
  ,requestPromise = require('request-promise')
  ,cheerio = require('cheerio')


async function openDB(dbName) {
  let createIndexes = false
  try {
    await nano.db.create(dbName)
    createIndexes = true
  } catch (err) {
    if (err.statusCode != 412) {
      throw err
    }
  }
  let bucket = nano.db.use(dbName)
  if (createIndexes) {
    const indexDef = {
      index: { fields: [{ "requests": "desc" }] },
      name: 'requestsIndex'
    }
    await bucket.createIndex(indexDef)
  }
  return bucket
}

async function start() {
  let bucket = await openDB("urls")

  let schema = buildSchema(`
    type Query {
      top: [URL]
    }
    type URL {
        _id: String,
        title: String,
        url: String,
        requests: Int
    }
    type Mutation {
      shorten(url: String): URL
    }
  `)

  let resolvers = {
    shorten: async (data) => {
      let shasum = crypto.createHash('sha1')
      shasum.update(data.url)
      let _id = shasum.digest('hex')
      let existing
      try {
        existing = await bucket.get(_id)
        return existing
      } catch (err) {
        console.log(err)
      }
      // Get page title
      let $ = await requestPromise({
        uri: data.url,
        transform: body => cheerio.load(body)
      })
      let title = $("head > title").text()
      data.title = title || "Untitled"
      data.requests = 0
      await bucket.insert({ ...data }, _id)
      return { _id }
    },
    top: async (query) => {
      let ret = await bucket.find({
        selector: {
          requests: { "$gt": 0 }
        },
        sort: [{ "requests": "desc" }],
        limit: 100
      })
      return ret.docs
    }
  }

  let app = express()

  app.use("/graphql", cors(), expressGraphQL({
    schema: schema,
    rootValue: resolvers,
    graphiql: true
  }))

  app.use("/:id", async (req, res, next) => {
    try {
      let ret = await bucket.get(req.params.id)
      ret.requests++
      bucket.insert(ret)
      return res.redirect(ret.url, 301)
    } catch (err) {
      return res.redirect("/")
    }
  })

  app.listen(3000, () => {
    console.log("Listening at :3000")
  })
}

start()