const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const express = require('express');

// 1. Sozlamalar
const token = '8705116857:AAGppWc6OqJIz-zPrYqV0XaUXby8f8vbUVU';
const MY_ID = 8142538424; // Siz bergan ID o'rnatildi
const DB_FILE = 'users.json';

const bot = new TelegramBot(token, { polling: true });
const app = express();

// 2. Ma'lumotlar bazasi bilan ishlash
let users = {};
if (fs.existsSync(DB_FILE)) {
    try {
        users = JSON.parse(fs.readFileSync(DB_FILE));
    } catch (e) {
        users = {};
    }
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

// 3. Savollar bazasi (Takomillashtirilgan)
const questions = [
    { question: "Real Madrid safida eng ko'p Oltin to'p olgan Kaka nechanchi yili bu mukofotga ega chiqqan?", options: ["2005", "2007", "2009"], answer: "2007" },
    { question: "JavaScript-da o'zgarmas qiymat qaysi kalit so'z bilan e'lon qilinadi?", options: ["var", "let", "const"], answer: "const" },
    { question: "Telegram bot yaratishda eng mashhur Node.js kutubxonasi qaysi?", options: ["telegraf", "node-telegram-bot-api", "express"], answer: "node-telegram-bot-api" },
    { question: "Kaka 'Milan'dan 'Real Madrid'ga necha million yevro evaziga o'tgan?", options: ["65 mln", "94 mln", "80 mln"], answer: "65 mln" }
];

// 4. Bot funksiyalari
function initUser(chatId, username) {
    if (!users[chatId]) {
        users[chatId] = {
            username: username || 'yoq',
            balance: 0,
            questionIndex: 0,
            referrals: 0,
            wallet: null,
            waitingWallet: false
        };
        saveDB();
    }
}

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    initUser(chatId, msg.from.username);
    
    // Adminga bildirishnoma
    if (chatId !== MY_ID) {
        bot.sendMessage(MY_ID, `🆕 Yangi foydalanuvchi: @${msg.from.username}\nID: ${chatId}`);
    }

    bot.sendMessage(chatId, "👋 Xush kelibsiz! Savollarga javob berib pul ishlang.", {
        reply_markup: {
            keyboard: [["🧠 Savollarni boshlash"], ["👤 Hisobim", "📨 Taklif qilish"]],
            resize_keyboard: true
        }
    });
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
            return bot.sendMessage(chatId, "✅ Karta raqamingiz saqlandi!");
        } else {
            return bot.sendMessage(chatId, "❌ Xato! 16 xonali raqam kiriting.");
        }
    }

    if (text === "🧠 Savollarni boshlash") {
        sendQuestion(chatId);
    } else if (text === "👤 Hisobim") {
        bot.sendMessage(chatId, `💰 Balans: ${user.balance} so'm\n💳 Karta: ${user.wallet || "Yo'q"}`, {
            reply_markup: {
                inline_keyboard: [[{ text: "💳 Karta kiritish", callback_data: "set_wallet" }]]
            }
        });
    }
});

function sendQuestion(chatId) {
    const user = users[chatId];
    if (user.questionIndex >= questions.length) {
        return bot.sendMessage(chatId, "🏁 Barcha savollar tugadi! Yangilarini kuting.");
    }

    const q = questions[user.questionIndex];
    bot.sendMessage(chatId, `❓ ${q.question}`, {
        reply_markup: {
            inline_keyboard: q.options.map(opt => [{ text: opt, callback_data: `ans_${opt}` }])
        }
    });
}

bot.on("callback_query", (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const user = users[chatId];

    // Cheksiz yuklanishni to'xtatish (3-tuzatish)
    bot.answerCallbackQuery(query.id);

    if (data === "set_wallet") {
        user.waitingWallet = true;
        bot.sendMessage(chatId, "💳 16 xonali karta raqamingizni yozib yuboring:");
    }

    if (data.startsWith("ans_")) {
        const answer = data.replace("ans_", "");
        const q = questions[user.questionIndex];

        if (answer === q.answer) {
            user.balance += 20000;
            bot.sendMessage(chatId, "✅ To'g'ri! +20,000 so'm");
        } else {
            bot.sendMessage(chatId, "❌ Noto'g'ri!");
        }

        user.questionIndex++; // (4-tuzatish: Index nazorati)
        saveDB();
        bot.deleteMessage(chatId, query.message.message_id);
        
        // Keyingi savolga o'tish
        setTimeout(() => sendQuestion(chatId), 1000);
    }
});

// Render uchun web server
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(process.env.PORT || 3000);
