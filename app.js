const { getDb } = require("./db.js")
  , express = require("express")
  , expressGraphQL = require("express-graphql")
  , buildSchema = require("graphql").buildSchema
  , cors = require("cors")
  , crypto = require('crypto')
  , requestPromise = require('request-promise')
  , cheerio = require('cheerio')
async function start() {
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
      let bucket = await getDb("urls")
      let shasum = crypto.createHash('sha1')
      shasum.update(data.url)
      let hash = shasum.digest('hex')
      let _id
      let retry = false
      let size = 1
      do {
        _id = hash.substr(0, size)
        let existing
        try {
          existing = await bucket.get(_id)
        } catch (err) {
          if (err.statusCode != 404) return err
          break // not found. will create a new one
        }
        // check whether current url hash equals existing hash 
        shasum = crypto.createHash('sha1')
        shasum.update(existing.url)
        let existing_hash = shasum.digest('hex')
        if (existing_hash === hash) {
          return existing
        }
        // conflict: another url has the same hash
        size++
        retry = true
      } while (retry)


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
      let bucket = await getDb("urls")
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
      let bucket = await getDb("urls")
      let ret = await bucket.get(req.params.id)
      ret.requests++
      bucket.insert(ret)
      return res.redirect(ret.url)
    } catch (err) {
      return res.redirect("/")
    }
  })

  app.listen(3000, () => {
    console.log("Listening at :3000")
  })
}

start()