require('dotenv').config()

const TelegramBot = require('node-telegram-bot-api')
const axios = require('axios')

const { TOKEN, HOST, NODE_ENV, API_KEY } = process.env
let bot

if (NODE_ENV === 'production') {
  bot = new TelegramBot(TOKEN)
  bot.setWebHook(HOST + TOKEN)
} else {
  bot = new TelegramBot(TOKEN, { polling: true })
}

console.log(`Bot started in the ${NODE_ENV} mode`)


function ruMobile(item) {
  const {
    number_current,
    def,
    code_start,
    code_end,
    operator,
    operator_full,
    region,
    bdpn,
    bdpn_operator,
    time,
  } = item

  return `
π± ${number_current} π·πΊ
π ${def} : ${code_start} β‘ ${code_end}
πΆ ${operator} ${operator_full}
π ${region}
π ${bdpn ? bdpn_operator : 'ΠΠΎΠΌΠ΅Ρ Π½Π΅ ΠΏΠ΅ΡΠ΅Π½Π΅ΡΡΠ½'}
π UTC${time < 0 ? '' : '+'}${+time.toLocaleString('ru-RU')}
`
}


function uaMobile(item) {
  const {
    number,
    def,
    operator,
    time,
  } = item

  return `
π± ${number} πΊπ¦
π ${def}
πΆ ${operator}
π UTC${time < 0 ? '' : '+'}${+time.toLocaleString('ru-RU')}
`
}


function ruFixed(item) {
  const {
    number,
    code,
    operator,
    operator_full,
    region,
    city,
    time,
  } = item

  return `
β ${number} π·πΊ
π ${code}
π ${operator} ${operator_full}
π ${region}
π ${city}
π UTC${time < 0 ? '' : '+'}${+time.toLocaleString('ru-RU')}
`
}


function otherMobile(item) {
  const {
    number,
    country_code,
    city_code,
    country,
    region,
    city,
    time,
  } = item

  return `
π± ${number} π΄ββ οΈ
π ${country_code} β‘ ${city_code}
π ${country} ${region}
π ${city}
π UTC${time < 0 ? '' : '+'}${+time.toLocaleString('ru-RU')}
`
}


function numbersMessage(numbers) {
  return numbers.map(item => {

    if (item.number_success) {
      switch (item.number_type_str) {
        case 'ru_mobile':
          return ruMobile(item)
        case 'ru_fixed':
          return ruFixed(item)
        case 'ua_mobile':
          return uaMobile(item)

        default:
          return otherMobile(item)
      }
    } else {
      const { error_code = '', error_message = '' } = item
      throw new Error(`βοΈ ΠΡΠΈΠ±ΠΊΠ° ΠΎΠΏΡΠ΅Π΄Π΅Π»Π΅Π½ΠΈΡ Π½ΠΎΠΌΠ΅ΡΠ° ${error_code} ${error_message}β`)
    }
  })
}


function jsonToMessage(data) {
  if (!data.success) {
    const { error_code = '', error_message = '' } = data
    throw new Error(`βοΈ ΠΡΠΈΠ±ΠΊΠ° ΠΏΠ°ΡΡΠΈΠ½Π³Π° ΡΠ΅Π·ΡΠ»ΡΡΠ°ΡΠ° ${error_code} ${error_message}β`)
  }

  const { query, quota, numbers } = data

  return `β*${query}*β
  ${numbersMessage(numbers).join('\n')}
  ${quota < 10 ? '\nπΠΡΡΠ°Π²ΡΠ°ΡΡΡ ΠΊΠ²ΠΎΡΠ°: ' + quota : ''}
  `
}


async function numberRequest(phoneNumber) {
  let data
  try {
    const res = await axios(`https://www.kody.su/api/v2.1/search.json?q=+${phoneNumber}&key=${API_KEY}`)
    data = res.data
  } catch (error) {
    data = error.response.data
  }
  return jsonToMessage(data).replace(/([\(\)\!\+.-])/g, '\\$1').replace(/&quot;/g, '"')
}


bot.onText(/^\/start$/, async (msg) => {
  await bot.sendPhoto(msg.chat.id, `${HOST}/defcodesbot.jpg`)
  await bot.sendMessage(msg.chat.id, `ΠΠ΄ΡΠ°Π²ΡΡΠ²ΡΠΉΡΠ΅β
Π­ΡΠΎ [Π±ΠΎΡ](https://defcodesbot.herokuapp.com/) Π΄Π»Ρ ΠΏΡΠΎΠ²Π΅ΡΠΊΠΈ ΡΠ΅Π»Π΅ΡΠΎΠ½Π½ΡΡ ΠΊΠΎΠ΄ΠΎΠ² βπ±.
ΠΠ»Ρ ΠΏΠΎΠ»ΡΡΠ΅Π½ΠΈΡ ΠΈΠ½ΡΠΎΡΠΌΠ°ΡΠΈΠΈ ΠΏΡΠΈΡΠ»ΠΈΡΠ΅ ΠΌΠ½Π΅ Π½ΠΎΠΌΠ΅Ρ Π² ΠΌΠ΅ΠΆΠ΄ΡΠ½Π°ΡΠΎΠ΄Π½ΠΎΠΌ ΡΠΎΡΠΌΠ°ΡΠ΅, Ρ "β" ΠΈΠ»ΠΈ Π±Π΅Π·.
ΠΏΡΠΈΠΌΠ΅Ρ:
*+79040000000*`.replace(/([\!\+.-])/g, '\\$1'), {
    parse_mode: 'MarkdownV2',
  })
})

bot.onText(/^\+*[0-9\(\)-\.\s]+$/, async (msg, match) => {
  try {
    const phoneNumber = match[0].replace(/\D/g, '')
    if (!phoneNumber) {
      throw new Error('βοΈ ΠΠΎΠΌΠ΅Ρ Π½Π΅ ΡΠΊΠ°Π·Π°Π½ ' + phoneNumber + 'β')
    }

    const message = await numberRequest(phoneNumber)

    await bot.sendMessage(msg.chat.id, message, {
      parse_mode: 'MarkdownV2',
    })
  } catch (error) {
    await bot.sendMessage(msg.chat.id, `βοΈ ΠΡΠΈΠ±ΠΊΠ° ΠΏΡΠΈ ΠΎΠ±ΡΠ°Π±ΠΎΡΠΊΠ΅ Π·Π°ΠΏΡΠΎΡΠ°β ${error.message || ''}`)
    console.error(error)
  }
})

module.exports = bot