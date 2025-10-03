require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// Token .env faylida
const token = process.env.TELEGRAM_TOKEN;
if (!token) {
  console.error("BOT token .env da topilmadi. TELEGRAM_TOKEN= qo'shing.");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// Adminlar
const adminIds = (process.env.ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

// Modullarni ulash
const { registerAdmin } = require('./admin');
const { registerCreateTest } = require('./createTest');
const { registerTestRunner, startTestForGroup } = require('./testRunner');
const { registerStartTest } = require('./startTest');

// Admin panel va test yaratish
registerCreateTest(bot, adminIds);
registerTestRunner(bot);
registerStartTest(bot, adminIds);
registerAdmin(bot, adminIds, { startTestForGroup, registerCreateTest });

// Fallback xabar
bot.on('message', (msg) => {
  const text = (msg.text || '').trim();
  if (text.startsWith('/')) return;
  bot.sendMessage(
    msg.chat.id,
    `Salom ${msg.from.first_name || ''}! Agar siz admin bo'lsangiz /admin buyrug'ini yuboring.`
  );
});

console.log("Bot ishga tushdi! 🚀");
