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

  return `📱 ${number_current} 🇷🇺
  🗂 ${def} : ${code_start} ➡ ${code_end}
  📶 ${operator} ${operator_full}
  🗺 ${region}${bdpn ? '\n🔀 ' + bdpn_operator : ''}
  🕓 ${time}
  `
}


function uaMobile(item) {
  const {
    number,
    def,
    operator,
    time,
  } = item

  return `📱 ${number} 🇺🇦
  🗂 ${def}
  📶 ${operator}
  🕓 ${time}
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

  return `☎ ${number} 🇷🇺
  🗂 ${code}
  ☎ ${operator} ${operator_full}
  🗺 ${region}
  🏙 ${city}
  🕓 ${time}
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

  return `📱 ${number} 🏴‍☠️
  🗂 ${country_code} ➡ ${city_code}
  🗺 ${country} ${region}
  🏙 ${city}
  🕓 ${time}
  `
}


function numbersMessage(numbers) {
  return numbers.map(item => {

    if (item.success) {
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
      const { error_code, error_message } = item
      throw new Error(`${error_code} ${error_message}❗`)
    }
  })
}


function jsonToMessage(data) {
  if (!data.success) {
    const { error_code, error_message } = data
    throw new Error(`${error_code} ${error_message}❗`)
  }

  const { query, numbers } = data

  return `❓*${query}*❓

  ${numbersMessage(numbers).join('\n')}
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
  return jsonToMessage(data).replace(/([\(\)\!\+.-])/g, '\\$1')
}


bot.onText(/^\/start$/, async (msg) => {
  await bot.sendMessage(msg.chat.id, `Здравствуйте!
Это бот для проверки телефонных кодов ☎📱.
Для получения информации пришлите мне номер в международном формате, с "➕" или без.
пример:
*+79040000000*`.replace(/([\(\)\!\+.-])/g, '\\$1'), {
    parse_mode: 'MarkdownV2',
  })
})

bot.onText(/^\+*[0-9\(\)-\.\s]+$/, async (msg, match) => {
  try {
    const phoneNumber = match[0].replace(/\D/g, '')
    if (!phoneNumber) {
      throw new Error('Номер не указан ' + phoneNumber + '!')
    }

    const message = await numberRequest(phoneNumber)

    await bot.sendMessage(msg.chat.id, message, {
      parse_mode: 'MarkdownV2',
    })
  } catch (error) {
    await bot.sendMessage(msg.chat.id, `Ошибка при обработке запроса❗\n${error.message || ''}`)
    console.error(error)
  }
})

module.exports = bot