// src/admin.js
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

function isAdmin(fromId, adminIds) {
  return adminIds.includes(String(fromId));
}

function registerAdmin(bot, adminIds, { startTestForGroup, registerCreateTest } = {}) {
  const flows = {};

  // /admin buyrug'i
  bot.onText(/\/admin/, (msg) => {
    const chatId = msg.chat.id;
    const fromId = msg.from.id;

    if (!isAdmin(fromId, adminIds)) {
      return bot.sendMessage(chatId, "Siz admin emassiz yoki admin ID ro'yxatida yo'q.");
    }

    sendAdminMenu(chatId);
  });

  function sendAdminMenu(chatId, messageId) {
    const keyboard = [
      [{ text: '📚 Guruhlar', callback_data: 'ADMIN_GROUPS' }],
      [{ text: '📝 Test yaratish', callback_data: 'ADMIN_CREATE_TEST' }],
      [{ text: '▶️ Testni boshlash', callback_data: 'ADMIN_START_TEST' }],
      [{ text: '📊 Natijalar', callback_data: 'ADMIN_RESULTS' }]
    ];

    const opts = {
      reply_markup: { inline_keyboard: keyboard }
    };

    if (messageId) {
      bot.editMessageText('Admin panel — tanlang:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: keyboard }
      });
    } else {
      bot.sendMessage(chatId, 'Admin panel — tanlang:', opts);
    }
  }

  // Callback querylar
  bot.on('callback_query', async (query) => {
    const data = query.data;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const fromId = query.from.id;

    if (!isAdmin(fromId, adminIds)) {
      return bot.answerCallbackQuery(query.id, { text: 'Ruxsat yo‘q' });
    }

    const db = loadDB();

    if (data === 'ADMIN_GROUPS') {
      const kb = [
        [{ text: '➕ Guruh qo\'shish', callback_data: 'ADMIN_GROUP_ADD' }],
        [{ text: '➖ Guruh o\'chirish', callback_data: 'ADMIN_GROUP_DELETE' }],
        [{ text: '🔙 Bosh menyu', callback_data: 'ADMIN_MENU_BACK' }]
      ];
      bot.editMessageText('Guruhlar boshqaruvi:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: kb }
      });
    }

    else if (data === 'ADMIN_GROUP_ADD') {
      flows[fromId] = { action: 'adding_group' };
      bot.sendMessage(chatId, 'Yangi guruh nomini yozing. Bekor qilish uchun /cancel.');
    }

    else if (data === 'ADMIN_GROUP_DELETE') {
      if (!db.groups.length) {
        bot.sendMessage(chatId, 'Hozircha guruhlar mavjud emas.');
        return;
      }
      const kb = db.groups.map(g => [{ text: g, callback_data: `ADMIN_GROUP_DEL:${g}` }]);
      kb.push([{ text: '🔙 Bosh menyu', callback_data: 'ADMIN_MENU_BACK' }]);
      bot.editMessageText('Qaysi guruhni o‘chirmoqchisiz?', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: kb }
      });
    }

    else if (data.startsWith('ADMIN_GROUP_DEL:')) {
      const groupName = data.split(':')[1];
      db.groups = db.groups.filter(g => g !== groupName);
      saveDB(db);
      bot.sendMessage(chatId, `Guruh "${groupName}" o‘chirildi.`);
    }

    else if (data === 'ADMIN_CREATE_TEST') {
      if (registerCreateTest) registerCreateTest(bot, fromId);
      else bot.sendMessage(chatId, 'Test yaratish moduli mavjud emas.');
    }

    else if (data === 'ADMIN_START_TEST') {
      if (!db.tests.length) return bot.sendMessage(chatId, 'Hozircha testlar mavjud emas.');
      if (!db.groups.length) return bot.sendMessage(chatId, 'Hozircha guruhlar mavjud emas.');
      if (startTestForGroup) {
        const testKeyboard = db.tests.map(t => [{ text: t.name, callback_data: `START_TEST:${t.name}` }]);
        testKeyboard.push([{ text: '🔙 Bosh menyu', callback_data: 'ADMIN_MENU_BACK' }]);
        bot.editMessageText('Qaysi testni boshlaymiz?', {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: { inline_keyboard: testKeyboard }
        });
      }
    }

    else if (data.startsWith('START_TEST:')) {
      const testName = data.split(':')[1];
      const test = db.tests.find(t => t.name === testName);
      if (!test) return bot.sendMessage(chatId, 'Test topilmadi.');
      const groupKeyboard = db.groups.map(g => [{ text: g, callback_data: `SEND_TEST:${testName}:${g}` }]);
      groupKeyboard.push([{ text: '🔙 Bosh menyu', callback_data: 'ADMIN_MENU_BACK' }]);
      bot.editMessageText('Qaysi guruhga test yuboramiz?', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: groupKeyboard }
      });
    }

    else if (data.startsWith('SEND_TEST:')) {
      const [_, testName, groupName] = data.split(':');
      const test = db.tests.find(t => t.name === testName);
      if (!test) return bot.sendMessage(chatId, 'Test topilmadi.');
      if (startTestForGroup) startTestForGroup(bot, groupName, test);
      bot.sendMessage(chatId, `Test "${testName}" guruh "${groupName}" foydalanuvchilariga yuborildi.`);
    }

    else if (data === 'ADMIN_RESULTS') {
      const results = db.results || [];
      if (!results.length) return bot.sendMessage(chatId, 'Hozircha natijalar mavjud emas.');
      const text = results.map(r => `UserID: ${r.userId}, To‘g‘ri javoblar: ${r.answers.filter(a => a.correct).length}/${r.answers.length}`).join('\n');
      bot.sendMessage(chatId, `Natijalar:\n${text}`);
    }

    else if (data === 'ADMIN_MENU_BACK') {
      sendAdminMenu(chatId, messageId);
    }

    bot.answerCallbackQuery(query.id);
  });

  bot.on('message', (msg) => {
    const fromId = msg.from.id;
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();

    if (text === '/cancel') {
      if (flows[fromId]) {
        delete flows[fromId];
        return bot.sendMessage(chatId, 'Operatsiya bekor qilindi.');
      }
    }

    const flow = flows[fromId];
    if (flow && flow.action === 'adding_group') {
      const name = text;
      if (!name) return bot.sendMessage(chatId, 'Iltimos haqiqiy guruh nomini kiriting.');
      const db = loadDB();
      if (db.groups.includes(name)) return bot.sendMessage(chatId, 'Bu guruh allaqachon mavjud.');
      db.groups.push(name);
      saveDB(db);
      delete flows[fromId];
      bot.sendMessage(chatId, `Guruh "${name}" muvaffaqiyatli qo‘shildi.`);
    }
  });
}

module.exports = { registerAdmin };
