const nano = require("nano")("http://localhost:5984")
  ,Express = require("express")
  ,ExpressGraphQL = require("express-graphql")
  ,BuildSchema = require("graphql").buildSchema
  ,cors = require("cors")
  ,crypto = require('crypto')


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

  let schema = BuildSchema(`
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

      if (typeof data.title === 'undefined') data.title = "Untitled"
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

  let app = Express()

  app.use("/graphql", cors(), ExpressGraphQL({
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