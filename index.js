const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const express = require('express');

const token = '8705116857:AAGppWc6OqJIz-zPrYqV0XaUXby8f8vbUVU';
const MY_ID = 8142538424; 
const DB_FILE = 'users.json';

// Xabarlar takrorlanishini (3 tadan kelishini) oldini olish uchun
const bot = new TelegramBot(token, { polling: { params: { drop_pending_updates: true } } });
const app = express();

let users = {};
if (fs.existsSync(DB_FILE)) {
    try { users = JSON.parse(fs.readFileSync(DB_FILE)); } catch (e) { users = {}; }
}

function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2)); }

const questions = [
    { question: "Real Madrid afsonasi Kaka nechanchi yili Oltin to'pni olgan?", options: ["2005", "2007", "2009"], answer: "2007" },
    { question: "Kaka Real Madridda nechanchi raqamda o'ynagan?", options: ["10", "8", "22"], answer: "8" },
    { question: "1 kilobayt necha bayt?", options: ["1000", "1024", "512"], answer: "1024" }
];

function initUser(chatId, username) {
    if (!users[chatId]) {
        users[chatId] = { username: username || 'noma'lum', balance: 0, questionIndex: 0, lastBonus: 0, wallet: null, waitingWallet: false };
        saveDB();
    }
}

// 4 TA TUGMALI MENYU
function sendMenu(chatId) {
    bot.sendMessage(chatId, "🏠 **Asosiy menyu**", {
        parse_mode: "Markdown",
        reply_markup: {
            keyboard: [
                ["🧠 Savollarni boshlash", "🎁 Kunlik Bonus"],
                ["👤 Hisobim", "📨 Taklif qilish"]
            ],
            resize_keyboard: true
        }
    });
}

bot.onText(/\/start/, (msg) => {
    initUser(msg.chat.id, msg.from.username);
    sendMenu(msg.chat.id);
});

bot.on("message", (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text || text.startsWith('/')) return;
    initUser(chatId, msg.from.username);
    const user = users[chatId];

    if (user.waitingWallet) {
        if (/^\d{16}$/.test(text)) {
            user.wallet = text;
            user.waitingWallet = false;
            saveDB();
            return bot.sendMessage(chatId, "✅ Karta saqlandi!");
        } else {
            return bot.sendMessage(chatId, "❌ 16 ta raqam yozing!");
        }
    }

    if (text === "🧠 Savollarni boshlash") { sendQuestion(chatId); } 
    else if (text === "🎁 Kunlik Bonus") {
        const now = Date.now();
        if (now - user.lastBonus < 86400000) {
            return bot.sendMessage(chatId, "⏳ Bonus olingan. Ertaga kiring.");
        }
        user.balance += 5000;
        user.lastBonus = now;
        saveDB();
        bot.sendMessage(chatId, "🎉 5,000 so'm bonus berildi!");
    }
    else if (text === "👤 Hisobim") {
        bot.sendMessage(chatId, `💰 Balans: ${user.balance} so'm\n💳 Karta: ${user.wallet || "Yo'q"}`, {
            reply_markup: { inline_keyboard: [[{ text: "💳 Karta kiritish", callback_data: "wallet" }]] }
        });
    }
    else if (text === "📨 Taklif qilish") {
        bot.sendMessage(chatId, `📨 Havolangiz: https://t.me/Pullik_Intelektual_Savolchi_Bot?start=${chatId}`);
    }
});

function sendQuestion(chatId) {
    const user = users[chatId];
    if (user.questionIndex >= questions.length) return bot.sendMessage(chatId, "🏁 Savollar tugadi.");
    const q = questions[user.questionIndex];
    bot.sendMessage(chatId, `❓ ${q.question}`, {
        reply_markup: { inline_keyboard: q.options.map(o => [{ text: o, callback_data: `ans_${o}` }]) }
    });
}

bot.on("callback_query", (q) => {
    const chatId = q.message.chat.id;
    bot.answerCallbackQuery(q.id);
    const user = users[chatId];
    if (q.data === "wallet") {
        user.waitingWallet = true;
        saveDB();
        bot.sendMessage(chatId, "💳 Kartani yuboring:");
    }
    if (q.data.startsWith("ans_")) {
        const choice = q.data.replace("ans_", "");
        if (choice === questions[user.questionIndex].answer) {
            user.balance += 10000;
            bot.sendMessage(chatId, "✅ To'g'ri!");
        } else { bot.sendMessage(chatId, "❌ Noto'g'ri!"); }
        user.questionIndex++;
        saveDB();
        bot.deleteMessage(chatId, q.message.message_id).catch(()=>{});
        setTimeout(() => sendQuestion(chatId), 500);
    }
});

app.get('/', (req, res) => res.send('Bot Active'));
app.listen(process.env.PORT || 3000);
