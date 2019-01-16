const nano = require("nano")("http://localhost:5984")
const Express = require("express")
const ExpressGraphQL = require("express-graphql")
const BuildSchema = require("graphql").buildSchema;
const UUID = require("uuid")


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
      URL(_id: String): URL,
      fromAddress(url: String): URL
      top: [URL]
    }
    type URL {
        _id: String,
        title: String,
        url: String,
        requests: Int
    }
    type Mutation {
      createURL(title: String, title: String, url: String): URL,
      incrementRequests (url: String): Int
    }
`)


  let resolvers = {
    createURL: async (data) => {
      let _id = UUID.v4()
      if (typeof data.title === 'undefined') data.title = "Untitled"
      data.requests = 0
      await bucket.insert({ ...data }, _id)
      return { _id }
    },
    URL: async (query) => {
      try {
        let ret = await bucket.get(query._id)
        return ret
      } catch (err) {
        return err
      }
    },
    fromAddress: async (query) => {
      let ret = await bucket.find({
        selector: {
          url: { "$eq": query.url },
        },
        limit: 1
      })
      return ret.docs[0]
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
    },
    incrementRequests: async (query) => {
      let doc = await resolvers.fromAddress(query)
      if (typeof doc.requests === 'undefined') doc.requests = 0
      doc.requests++
      await bucket.insert(doc)
      return doc.requests
    }
  }

  let app = Express()

  app.use("/graphql", ExpressGraphQL({
    schema: schema,
    rootValue: resolvers,
    graphiql: true
  }))

  app.listen(3000, () => {
    console.log("Listening at :3000")
  })
}

start()