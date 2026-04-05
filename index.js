const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const token = '8705116857:AAGppWc6OqJIz-zPrYqV0XaUXby8f8vbUVU';
const MY_ID = 8705116857; 

const bot = new TelegramBot(token, { polling: true });
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot status: Online'));
app.listen(PORT, () => console.log(`Server running on ${PORT}`));

let users = {};

const questions = [
  { question: "Dunyoning eng katta okeani?", options: ["Atlantika", "Hind", "Tinch", "Arktika"], answer: "Tinch" },
  { question: "Python qachon yaratilgan?", options: ["1985", "1991", "2000", "1995"], answer: "1991" },
  { question: "O'zbekiston poytaxti?", options: ["Samarqand", "Buxoro", "Toshkent", "Namangan"], answer: "Toshkent" },
  { question: "1 byte nechta bit?", options: ["4", "8", "16", "32"], answer: "8" }
];

function initUser(id) {
  if (!users[id]) {
    users[id] = { balance: 0, wallet: null, referrals: 0, questionIndex: 0, lastBonus: 0, waitingWallet: false };
  }
}

function sendQuestion(chatId) {
  let user = users[chatId];
  if (user.questionIndex >= questions.length) {
    return bot.sendMessage(chatId, "🎉 Siz barcha savollarni ishlab bo‘lgansiz!\n🎁 Bonus orqali balansingizni oshirib boring.");
  }
  let q = questions[user.questionIndex];
  bot.sendMessage(chatId, `❓ ${q.question}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: q.options[0], callback_data: "q_" + q.options[0] }, { text: q.options[1], callback_data: "q_" + q.options[1] }],
        [{ text: q.options[2], callback_data: "q_" + q.options[2] }, { text: q.options[3], callback_data: "q_" + q.options[3] }]
      ]
    }
  });
}

bot.onText(/\/start(.*)/, (msg, match) => {
  let chatId = msg.chat.id;
  initUser(chatId);
  if (chatId !== MY_ID) bot.sendMessage(MY_ID, `🔔 Yangi foydalanuvchi kirdi!\nID: ${chatId}\nUsername: @${msg.from.username || 'yoq'}`);
  
  bot.sendMessage(chatId, "👋 Xush kelibsiz!", {
    reply_markup: {
      keyboard: [["🧠 Savollarni boshlash"], ["👤 Hisobim", "🎁 Bonus"], ["📨 Taklif qilish"]],
      resize_keyboard: true
    }
  });
});

bot.on("message", (msg) => {
  let chatId = msg.chat.id;
  let text = msg.text;
  if (!text || text.startsWith('/start')) return;
  initUser(chatId);
  let user = users[chatId];

  if (user.waitingWallet && /^\d{16}$/.test(text)) {
    user.wallet = text;
    user.waitingWallet = false;
    return bot.sendMessage(chatId, "✅ Karta saqlandi!");
  }

  if (text === "🧠 Savollarni boshlash") sendQuestion(chatId);
  else if (text === "👤 Hisobim") {
    bot.sendMessage(chatId, `💰 Balans: ${user.balance} so'm\n💳 Karta: ${user.wallet || "yoq"}`, {
      reply_markup: { inline_keyboard: [[{ text: "💸 Pul yechish", callback_data: "withdraw" }, { text: "💳 Hamyon", callback_data: "wallet" }]] }
    });
  }
});

bot.on("callback_query", (query) => {
  let chatId = query.message.chat.id;
  let user = users[chatId];
  let data = query.data;

  if (data === "wallet") {
    user.waitingWallet = true;
    bot.sendMessage(chatId, "💳 Karta raqamingizni yuboring:");
  } else if (data.startsWith("q_")) {
    let answer = data.replace("q_", "");
    let q = questions[user.questionIndex];
    if (answer === q.answer) {
      user.balance += 20000;
      bot.sendMessage(chatId, "✅ To'g'ri! +20,000 so'm.");
    } else bot.sendMessage(chatId, "❌ Noto'g'ri.");
    user.questionIndex++;
    bot.deleteMessage(chatId, query.message.message_id);
    setTimeout(() => sendQuestion(chatId), 1000);
  }
  bot.answerCallbackQuery(query.id);
});
