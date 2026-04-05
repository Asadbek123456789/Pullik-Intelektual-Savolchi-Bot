const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Botingiz tokeni
const token = '8705116857:AAGppWc6OqJIz-zPrYqV0XaUXby8f8vbUVU';

// Render uchun Pollingni yoqamiz
const bot = new TelegramBot(token, { polling: true });

// Render botni o'chirib qo'ymasligi uchun Web Server yaratamiz
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot status: Online');
});

app.listen(PORT, () => {
    console.log(`Server ${PORT}-portda ishlamoqda...`);
});

// Foydalanuvchilar bazasi (Vaqtinchalik)
let users = {};

const questions = [
  { question: "Dunyoning eng katta okeani?", options: ["Atlantika", "Hind", "Tinch", "Arktika"], answer: "Tinch" },
  { question: "Python qachon yaratilgan?", options: ["1985", "1991", "2000", "1995"], answer: "1991" },
  { question: "O'zbekiston poytaxti?", options: ["Samarqand", "Buxoro", "Toshkent", "Namangan"], answer: "Toshkent" },
  { question: "1 byte nechta bit?", options: ["4", "8", "16", "32"], answer: "8" }
];

function initUser(id) {
  if (!users[id]) {
    users[id] = { balance: 0, wallet: null, referrals: 0, answered: false, questionIndex: 0, lastBonus: 0, waitingWallet: false };
  }
}

function sendMenu(chatId) {
  bot.sendMessage(chatId, "🏠 Asosiy menyu", {
    reply_markup: {
      keyboard: [["🧠 Savollarni boshlash"], ["👤 Hisobim", "🎁 Bonus"], ["📨 Taklif qilish"]],
      resize_keyboard: true
    }
  });
}

function sendQuestion(chatId) {
  let user = users[chatId];
  if (user.questionIndex >= questions.length) {
    user.answered = true;
    return bot.sendMessage(chatId, "🎉 Savollar tugadi!\nBonus orqali balansingizni oshirib boring.");
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
  let ref = match[1];
  initUser(chatId);
  if (ref && ref.trim()) {
    let refId = ref.trim();
    if (users[refId] && refId != chatId.toString()) {
      users[refId].referrals += 1;
      bot.sendMessage(refId, "👥 Sizning havolangiz orqali yangi do'st qo'shildi!");
    }
  }
  bot.sendMessage(chatId, "👋 Xush kelibsiz! Savollarga javob berib pul ishlang.");
  sendMenu(chatId);
});

bot.on("message", (msg) => {
  let chatId = msg.chat.id;
  let text = msg.text;
  if (!text || text.startsWith('/start')) return;
  initUser(chatId);
  let user = users[chatId];

  if (text === "🧠 Savollarni boshlash") {
    if (user.answered) return bot.sendMessage(chatId, "❗ Siz barcha savollarni ishlab bo‘lgansiz.");
    user.questionIndex = 0;
    sendQuestion(chatId);
  } else if (text === "👤 Hisobim") {
    bot.sendMessage(chatId, `👤 Hisobingiz:\n💰 ${user.balance} so'm\n💳 Karta: ${user.wallet || "kiritilmagan"}\n👥 Takliflar: ${user.referrals} ta`, {
      reply_markup: { 
        inline_keyboard: [[{ text: "💸 Pul yechish", callback_data: "withdraw" }, { text: "💳 Hamyon", callback_data: "wallet" }]] 
      }
    });
  } else if (text === "🎁 Bonus") {
    let now = Date.now();
    if (now - user.lastBonus < 86400000) return bot.sendMessage(chatId, "⏳ Siz bugungi bonusni olib bo‘lgansiz. Ertaga qaytib keling!");
    bot.sendMessage(chatId, "🎁 Qutini tanlang:", {
      reply_markup: { 
        inline_keyboard: [[{ text: "🎁", callback_data: "b1" }, { text: "🎁", callback_data: "b2" }], [{ text: "🎁", callback_data: "b3" }, { text: "🎁", callback_data: "b4" }]] 
      }
    });
  } else if (text === "📨 Taklif qilish") {
    let link = `https://t.me/Pullik_Intelektual_Savolchi_Bot?start=${chatId}`;
    bot.sendMessage(chatId, `📨 Do‘st taklif qiling va mukofot oling:\n${link}`, {
      reply_markup: { inline_keyboard: [[{ text: "📨 Ulashish", url: `https://t.me/share/url?url=${link}` }]] }
    });
  }

  if (user.waitingWallet && /^\d{16}$/.test(text)) {
    user.wallet = text;
    user.waitingWallet = false;
    bot.sendMessage(chatId, "✅ Hamyon (karta) muvaffaqiyatli saqlandi!");
  }
});

bot.on("callback_query", (query) => {
  let chatId = query.message.chat.id;
  let user = users[chatId];
  if (!user) initUser(chatId);
  let data = query.data;

  if (data.startsWith("b")) {
    const rewards = [3000, 5000, 7000, 9000];
    let reward = rewards[Math.floor(Math.random() * rewards.length)];
    users[chatId].balance += reward;
    users[chatId].lastBonus = Date.now();
    bot.answerCallbackQuery(query.id, { text: `🎉 Sizga ${reward} so'm berildi!` });
    bot.deleteMessage(chatId, query.message.message_id);
    return bot.sendMessage(chatId, `🎉 Siz ${reward} so'm bonus oldingiz!`);
  }

  if (data === "wallet") {
    users[chatId].waitingWallet = true;
    bot.answerCallbackQuery(query.id);
    return bot.sendMessage(chatId, "💳 16 xonali plastik karta raqamingizni yuboring:");
  }

  if (data === "withdraw") {
    bot.answerCallbackQuery(query.id);
    if (users[chatId].referrals < 10) return bot.sendMessage(chatId, "❗ Pul yechish uchun kamida 10 ta taklifingiz bo'lishi kerak.");
    if (!users[chatId].wallet) return bot.sendMessage(chatId, "❗ Avval hisobim bo'limida hamyon raqamingizni kiriting.");
    return bot.sendMessage(chatId, "✅ To‘lov so‘rovingiz qabul qilindi. 24 soat ichida ko'rib chiqiladi.");
  }

  if (data.startsWith("q_")) {
    let answer = data.replace("q_", "");
    let q = questions[users[chatId].questionIndex];
    if (answer === q.answer) {
      users[chatId].balance += 20000;
      bot.answerCallbackQuery(query.id, { text: "✅ To'g'ri!" });
      bot.sendMessage(chatId, "✅ To‘g‘ri javob! Balansingizga +20,000 so'm qo'shildi.");
    } else {
      bot.answerCallbackQuery(query.id, { text: "❌ Noto'g'ri" });
      bot.sendMessage(chatId, "❌ Noto‘g‘ri javob.");
    }
    users[chatId].questionIndex++;
    bot.deleteMessage(chatId, query.message.message_id);
    setTimeout(() => sendQuestion(chatId), 500);
  }
});

bot.on('polling_error', (error) => console.log(error));