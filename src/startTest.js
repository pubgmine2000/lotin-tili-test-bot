// src/startTest.js
const { startTestForUser } = require('./testRunner');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'db.json');

function loadDB() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { groups: [], tests: [], users: [], results: [] };
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

// Guruh uchun test boshlash
function startTestForGroup(bot, groupName, test) {
  const db = loadDB();
  const users = db.users || [];
  const groupUsers = users.filter(u => u.group === groupName);

  if (!groupUsers.length) {
    bot.sendMessage(0, `Guruh "${groupName}"da foydalanuvchilar topilmadi.`); // Adminga info berish uchun kerak
    return;
  }

  groupUsers.forEach(u => {
    startTestForUser(bot, u.chatId, u.userId, test);
  });
}

// Guruhga foydalanuvchi qo'shish (admin paneldan ishlatiladi)
function addUserToGroup(userId, chatId, groupName) {
  const db = loadDB();
  db.users = db.users || [];
  const exists = db.users.find(u => u.userId === userId);
  if (!exists) {
    db.users.push({ userId, chatId, group: groupName });
    saveDB(db);
  }
}

function registerStartTest(bot, adminIds) {
  // Agar kerak bo'lsa callback query orqali test yuborish
  bot.on('callback_query', async (callbackQuery) => {
    const fromId = callbackQuery.from.id;
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    if (!adminIds.includes(String(fromId))) {
      return bot.answerCallbackQuery(callbackQuery.id, { text: 'Ruxsat yo‘q' });
    }

    if (data && data.startsWith('SEND_TEST:')) {
      const [_, testName, groupName] = data.split(':');
      const db = loadDB();
      const test = db.tests.find(t => t.name === testName);
      if (!test) {
        bot.sendMessage(chatId, `Test topilmadi: ${testName}`);
        return bot.answerCallbackQuery(callbackQuery.id);
      }
      startTestForGroup(bot, groupName, test);
      bot.sendMessage(chatId, `Test "${testName}" guruh "${groupName}" foydalanuvchilariga yuborildi.`);
      bot.answerCallbackQuery(callbackQuery.id);
    }
  });
}

module.exports = { startTestForGroup, addUserToGroup, registerStartTest };
