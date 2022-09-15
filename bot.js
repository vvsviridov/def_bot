require('dotenv').config()

const TelegramBot = require('node-telegram-bot-api')
const axios = require('axios')
const { JSDOM } = require('jsdom')
const FormData = require('form-data')

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


function formatHtmlToMessage(message1, message2) {
  return `${message1}\n${message2}`.replace(/, \//g, '\n').replace(/\//g, '').replace(/:\n/g, ': ')
}


async function tryHtml(query) {
  const formData = new FormData()
  formData.append('number', query)
  const axiosConfig = {
    method: 'post',
    url: 'https://www.kody.su/check-tel',
    headers: formData.getHeaders(),
    data: formData
  }
  const { data } = await axios.request(axiosConfig)

  const dom = new JSDOM(data)
  const p = dom.window.document.querySelectorAll('p')
  const tr = dom.window.document.querySelectorAll('td')
  const message1 = Array.from(p).slice(2, -1).map(item => item.textContent).join('\n')
  const message2 = Array.from(tr).slice(3, 5).map(item => item.textContent).join('\n')

  return `✅*${query}*❓\n${formatHtmlToMessage(message1, message2)}
  `
}


async function numberRequest(phoneNumber) {
  let data
  try {
    const res = await axios(`https://www.kody.su/api/v2.1/search.json?q=+${phoneNumber}&key=${API_KEY}`)
    data = res.data
  } catch (error) {
    if (error.response.data.error_code === 'LIMIT_EXCEEDED') return tryHtml(error.response.data.query)
    data = error.response.data
  }
  return jsonToMessage(data)
}


bot.onText(/^\/start$/, async (msg) => {
  await bot.sendPhoto(msg.chat.id, `${HOST}/defcodesbot.jpg`)
  await bot.sendMessage(msg.chat.id, `Здравствуйте❗
Это [бот](https://defbot-production.up.railway.app/) для проверки телефонных кодов ☎📱.
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

    await bot.sendMessage(msg.chat.id, message.replace(/([\(\)\!\+.-])/g, '\\$1').replace(/&quot;/g, '"'), {
      parse_mode: 'MarkdownV2',
    })
  } catch (error) {
    await bot.sendMessage(msg.chat.id, `⛔️ Ошибка при обработке запроса❗ ${error.message || ''}`)
    console.error(error)
  }
})

module.exports = bot