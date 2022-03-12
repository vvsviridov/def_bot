require('dotenv').config()

const express = require('express')

const bot = require('./bot')

const app = express()

const port = process.env.PORT || 5000
const { TOKEN } = process.env

app.use(express.json())
app.use('/', express.static('public'))

// app.get('/', (req, res) => {
//   res.status(200).json({ message: 'Hello from the Bot API.' })
// })
// TELEGRAM WEBHOOK - https://core.telegram.org/bots/api#setwebhook
app.post(`/${TOKEN}`, (req, res) => {
  bot.processUpdate(req.body)
  res.status(200).json({ message: 'ok' })
})

app.listen(port, () => {
  console.log(`\n\nServer running on port ${port}.\n\n`)
})