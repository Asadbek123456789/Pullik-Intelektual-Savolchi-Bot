const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const express = require('express');

// --- SOZLAMALAR ---
const token = '8705116857:AAGppWc6OqJIz-zPrYqV0XaUXby8f8vbUVU';
const MY_ID = 8142538424; 
const DB_FILE = 'users.json';

// Botni sozlash (Takroriy xabarlarni oldini olish uchun dropPendingUpdates qo'shildi)
const bot = new TelegramBot(token, { 
    polling: { 
        params: { 
            drop_pending_updates: true 
        } 
    } 
});

const app = express();

// --- MA'LUMOTLAR BAZASI ---
let users = {};
function loadDB() {
    if (fs.existsSync(DB_FILE)) {
        try {
            const data = fs.readFileSync(DB_FILE);
            users = JSON.parse(data);
        } catch (e) {
            users = {};
        }
    }
}
loadDB();

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

// --- SAVOLLAR ---
const questions = [
    { question: "Real Madrid afsonasi Kaka nechanchi yili Oltin to'pni olgan?", options: ["2005", "2007", "2009"], answer: "2007" },
    { question: "Web dasturlashda 'HTML' nima?", options: ["Dasturlash tili", "Belgilash tili", "Baza turi"], answer: "Belgilash tili" },
    { question: "1 kilobayt necha baytga teng?", options: ["1000", "1024", "2048"], answer: "1024" },
    { question: "Kaka qaysi davlat terma jamoasida o'ynagan?", options: ["Italiya", "Braziliya", "Ispaniya"], answer: "Braziliya" }
];

// --- FUNKSIYALAR ---
function initUser(chatId, username) {
    if (!users[chatId]) {
        users[chatId] = {
            username: username || 'yoq',
            balance: 0,
            questionIndex: 0,
            lastBonus: 0,
            wallet: null,
            waitingWallet: false
        };
        saveDB();
    }
}

// --- BUYRUQLAR ---
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    initUser(chatId, msg.from.username);
    
    bot.sendMessage(chatId, "👋 Hush kelibsiz! Savollarga javob bering va bonuslar oling.", {
        reply_markup: {
            keyboard: [
                ["🧠 Savollarni boshlash"],
                ["👤 Hisobim", "🎁 Kunlik Bonus"]
            ],
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

    // Karta raqamini kutish
    if (user.waitingWallet) {
        if (/^\d{16}$/.test(text)) {
            user.wallet = text;
            user.waitingWallet = false;
            saveDB();
            return bot.sendMessage(chatId, "✅ Karta raqamingiz muvaffaqiyatli saqlandi.");
        } else {
            return bot.sendMessage(chatId, "❌ Xato! Faqat 16 ta raqamdan iborat karta raqamini yozing.");
        }
    }

    if (text === "🧠 Savollarni boshlash") {
        sendQuestion(chatId);
    } else if (text === "👤 Hisobim") {
        bot.sendMessage(chatId, `👤 **Sizning balansingiz:**\n\n💰 Pul: ${user.balance} so'm\n💳 Karta: ${user.wallet || "Kiritilmagan"}`, {
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [[{ text: "💳 Karta raqamni kiritish", callback_data: "set_wallet" }]]
            }
        });
    } else if (text === "🎁 Kunlik Bonus") {
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000; // 24 soat millisekundlarda

        if (now - user.lastBonus >= oneDay) {
            const reward = 5000; // Bonus miqdori
            user.balance += reward;
            user.lastBonus = now;
            saveDB();
            bot.sendMessage(chatId, `🎉 Tabriklaymiz! Sizga ${reward} so'm kunlik bonus berildi.`);
        } else {
            const nextBonus = new Date(user.lastBonus + oneDay);
            const timeLeft = Math.ceil((nextBonus - now) / (60 * 60 * 1000));
            bot.sendMessage(chatId, `⏳ Bonus olib bo'lingan. Keyingi bonusgacha taxminan ${timeLeft} soat qoldi.`);
        }
    }
});

function sendQuestion(chatId) {
    const user = users[chatId];
    if (user.questionIndex >= questions.length) {
        return bot.sendMessage(chatId, "🏁 Barcha savollar tugadi! Tez orada yangilari qo'shiladi.");
    }

    const q = questions[user.questionIndex];
    const options = q.options.map(opt => [{ text: opt, callback_data: `ans_${opt}` }]);

    bot.sendMessage(chatId, `❓ ${q.question}`, {
        reply_markup: { inline_keyboard: options }
    });
}

bot.on("callback_query", (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const user = users[chatId];

    bot.answerCallbackQuery(query.id);

    if (data === "set_wallet") {
        user.waitingWallet = true;
        saveDB();
        bot.sendMessage(chatId, "💳 16 xonali plastik karta raqamingizni yuboring:");
    }

    if (data.startsWith("ans_")) {
        const answer = data.replace("ans_", "");
        const q = questions[user.questionIndex];

        if (answer === q.answer) {
            user.balance += 10000;
            bot.sendMessage(chatId, "✅ To'g'ri javob! +10,000 so'm.");
        } else {
            bot.sendMessage(chatId, "❌ Noto'g'ri javob.");
        }

        user.questionIndex++;
        saveDB();
        
        // Xabarni o'chirish (tozalik uchun)
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        
        // Keyingi savolga o'tish
        setTimeout(() => sendQuestion(chatId), 800);
    }
});

// Render uchun server
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);
