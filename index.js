const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs');

const token = '8705116857:AAGppWc6OqJIz-zPrYqV0XaUXby8f8vbUVU';
const MY_ID = 8142538424; 
const DB_FILE = 'users.json';

// Render'da uyg'oq turishi uchun port
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is Live'));
app.listen(PORT, () => console.log(`Server running on ${PORT}`));

// Pollingni takrorlanmaydigan qilib sozlash
const bot = new TelegramBot(token, { polling: { params: { drop_pending_updates: true } } });

let users = {};
if (fs.existsSync(DB_FILE)) {
    try { users = JSON.parse(fs.readFileSync(DB_FILE)); } catch (e) { users = {}; }
}

function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2)); }

const questions = [
    { question: "Kaka nechanchi yili Oltin to'p olgan?", options: ["2005", "2007", "2009"], answer: "2007" },
    { question: "Kaka Real Madridda qaysi raqamda o'ynagan?", options: ["10", "8", "22"], answer: "8" }
];

function initUser(id, username) {
    if (!users[id]) {
        users[id] = { username: username || '', balance: 0, questionIndex: 0, lastBonus: 0, wallet: null, waitingWallet: false };
        saveDB();
    }
}

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
            return bot.sendMessage(chatId, "❌ 16 xonali raqam yozing!");
        }
    }

    if (text === "🧠 Savollarni boshlash") {
        const q = questions[user.questionIndex];
        if (!q) return bot.sendMessage(chatId, "🏁 Savollar tugadi.");
        bot.sendMessage(chatId, `❓ ${q.question}`, {
            reply_markup: { inline_keyboard: q.options.map(o => [{ text: o, callback_data: `ans_${o}` }]) }
        });
    } 
    else if (text === "🎁 Kunlik Bonus") {
        const now = Date.now();
        if (now - user.lastBonus < 86400000) return bot.sendMessage(chatId, "⏳ Ertaga kiring.");
        user.balance += 5000;
        user.lastBonus = now;
        saveDB();
        bot.sendMessage(chatId, "🎉 5,000 so'm bonus berildi!");
    }
    else if (text === "👤 Hisobim") {
        bot.sendMessage(chatId, `💰 Balans: ${user.balance}\n💳 Karta: ${user.wallet || "Yo'q"}`, {
            reply_markup: { inline_keyboard: [[{ text: "💳 Karta kiritish", callback_data: "wallet" }]] }
        });
    }
});

bot.on("callback_query", (q) => {
    const chatId = q.message.chat.id;
    const user = users[chatId];
    bot.answerCallbackQuery(q.id);

    if (q.data === "wallet") {
        user.waitingWallet = true;
        saveDB();
        bot.sendMessage(chatId, "💳 Kartangizni yuboring:");
    }
    if (q.data.startsWith("ans_")) {
        const choice = q.data.replace("ans_", "");
        if (choice === questions[user.questionIndex].answer) {
            user.balance += 10000;
            bot.sendMessage(chatId, "✅ To'g'ri!");
        }
        user.questionIndex++;
        saveDB();
        bot.deleteMessage(chatId, q.message.message_id).catch(()=>{});
        // Keyingi savol uchun start buyrug'i kabi mantiq
        bot.sendMessage(chatId, "Keyingi savol uchun yana 'Savollarni boshlash'ni bosing yoki menyudan foydalaning.");
    }
});
