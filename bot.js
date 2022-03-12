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
📱 ${number_current} 🇷🇺
🗂 ${def} : ${code_start} ➡ ${code_end}
📶 ${operator} ${operator_full}
🌐 ${region}
🔀 ${bdpn ? bdpn_operator : 'Номер не перенесён'}
🕓 UTC${time < 0 ? '' : '+'}${+time.toLocaleString('ru-RU')}
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
📱 ${number} 🇺🇦
🗂 ${def}
📶 ${operator}
🕓 UTC${time < 0 ? '' : '+'}${+time.toLocaleString('ru-RU')}
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
☎ ${number} 🇷🇺
🗂 ${code}
📞 ${operator} ${operator_full}
🌐 ${region}
🏙 ${city}
🕓 UTC${time < 0 ? '' : '+'}${+time.toLocaleString('ru-RU')}
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
📱 ${number} 🏴‍☠️
🗂 ${country_code} ➡ ${city_code}
🌐 ${country} ${region}
🏙 ${city}
🕓 UTC${time < 0 ? '' : '+'}${+time.toLocaleString('ru-RU')}
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
      throw new Error(`⛔️ Ошибка определения номера ${error_code} ${error_message}❗`)
    }
  })
}


function jsonToMessage(data) {
  if (!data.success) {
    const { error_code = '', error_message = '' } = data
    throw new Error(`⛔️ Ошибка парсинга результата ${error_code} ${error_message}❗`)
  }

  const { query, quota, numbers } = data

  return `✅*${query}*❓

  ${numbersMessage(numbers).join('\n')}
  ${quota < 10 ? '\n🆓Оставшаяся квота: ' + quota : ''}
  `
}


async function numberRequest(phoneNumber) {
  let data
  try {
    // const res = await axios(`https://www.kody.su/api/v2.1/search.json?q=+${phoneNumber}&key=${API_KEY}`)
    // data = res.data
    data = {
      "success": true,
      "query": "79040000000",
      "quota": 11,
      "numbers": [
        {
          "number_current": "79040000000",
          "number_success": true,
          "number_type_str": "ru_mobile",
          "number_type": 1,
          "def": "904",
          "number": "0000000",
          "code_start": "0000000",
          "code_end": "0299999",
          "operator": "Tele2",
          "operator_full": "ЗАО \"Смоленская Сотовая Связь\" Тверь",
          "region": "Тверская область",
          "time": "3.0",
          "bdpn": false,
          "bdpn_operator": ""
        }
      ]
    }
  } catch (error) {
    data = error.response.data
  }
  return jsonToMessage(data).replace(/([\(\)\!\+.-])/g, '\\$1').replace(/&quot;/g, '"')
}


bot.onText(/^\/start$/, async (msg) => {
  // await bot.sendPhoto(msg.chat.id, `https://defcodesbot.herokuapp.com/defcodesbot.jpg`)
  await bot.sendPhoto(msg.chat.id, `${HOST}/defcodesbot.jpg`)
  await bot.sendMessage(msg.chat.id, `Здравствуйте❗
Это [бот](https://defcodesbot.herokuapp.com/) для проверки телефонных кодов ☎📱.
Для получения информации пришлите мне номер в международном формате, с "➕" или без.
пример:
*+79040000000*`.replace(/([\!\+.-])/g, '\\$1'), {
    parse_mode: 'MarkdownV2',
  })
})

bot.onText(/^\+*[0-9\(\)-\.\s]+$/, async (msg, match) => {
  try {
    const phoneNumber = match[0].replace(/\D/g, '')
    if (!phoneNumber) {
      throw new Error('⛔️ Номер не указан ' + phoneNumber + '❗')
    }

    const message = await numberRequest(phoneNumber)

    await bot.sendMessage(msg.chat.id, message, {
      parse_mode: 'MarkdownV2',
    })
  } catch (error) {
    await bot.sendMessage(msg.chat.id, `⛔️ Ошибка при обработке запроса❗ ${error.message || ''}`)
    console.error(error)
  }
})

module.exports = bot