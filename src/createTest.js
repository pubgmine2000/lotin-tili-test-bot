// src/createTest.js
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'db.json');

function loadDB() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { tests: [] };
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

const flows = {}; // userId => current flow

function registerCreateTest(bot, adminId) {
  bot.on('message', (msg) => {
    const fromId = msg.from.id;
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();

    if (fromId != adminId) return; // faqat bitta admin ishlatadi

    const flow = flows[fromId];
    if (!flow) return;

    if (text === '/cancel') {
      delete flows[fromId];
      return bot.sendMessage(chatId, 'Test yaratish bekor qilindi.');
    }

    switch (flow.step) {
      case 'ask_test_name':
        if (!text) return bot.sendMessage(chatId, 'Iltimos, test nomini kiriting.');
        flow.test.name = text;
        flow.test.questions = [];
        flow.step = 'ask_question';
        bot.sendMessage(chatId, 'Birinchi savolni kiriting:');
        break;

      case 'ask_question':
        if (!text) return bot.sendMessage(chatId, 'Iltimos, savol matnini kiriting.');
        flow.currentQuestion = { text, variants: [] };
        flow.step = 'ask_variants';
        bot.sendMessage(chatId, 'Variantlarni vergul bilan yozing (masalan: A,B,C,D):');
        break;

      case 'ask_variants':
        const variants = text.split(',').map(v => v.trim()).filter(Boolean);
        if (!variants.length) return bot.sendMessage(chatId, 'Iltimos, haqiqiy variantlarni kiriting.');
        flow.currentQuestion.variants = variants;
        flow.step = 'ask_correct';
        bot.sendMessage(chatId, `To‘g‘ri javobni yozing (variantlardan biri): ${variants.join(', ')}`);
        break;

      case 'ask_correct':
        if (!flow.currentQuestion.variants.includes(text)) {
          return bot.sendMessage(chatId, `Iltimos variantlardan birini yozing: ${flow.currentQuestion.variants.join(', ')}`);
        }
        flow.currentQuestion.correct = text;
        flow.step = 'ask_time';
        bot.sendMessage(chatId, 'Savol uchun vaqtni sekundda kiriting (masalan 10):');
        break;

      case 'ask_time':
        const time = parseInt(text);
        if (isNaN(time) || time <= 0) return bot.sendMessage(chatId, 'Iltimos, to‘g‘ri raqam kiriting.');
        flow.currentQuestion.time = time;
        flow.test.questions.push(flow.currentQuestion);
        flow.currentQuestion = null;
        flow.step = 'ask_continue';
        bot.sendMessage(chatId, 'Savol qo‘shildi! Yana savol qo‘shmoqchimisiz? Ha/Yo‘q');
        break;

      case 'ask_continue':
        if (text.toLowerCase() === 'ha') {
          flow.step = 'ask_question';
          bot.sendMessage(chatId, 'Navbatdagi savolni kiriting:');
        } else {
          const db = loadDB();
          db.tests = db.tests || [];
          db.tests.push(flow.test);
          saveDB(db);
          delete flows[fromId];
          bot.sendMessage(chatId, `Test "${flow.test.name}" saqlandi!`);
        }
        break;
    }
  });

  bot.on('callback_query', (query) => {
    const fromId = query.from.id;
    const chatId = query.message.chat.id;

    if (fromId != adminId) return bot.answerCallbackQuery(query.id, { text: 'Ruxsat yo‘q' });

    if (query.data === 'ADMIN_CREATE_TEST') {
      flows[fromId] = { step: 'ask_test_name', test: {} };
      bot.sendMessage(chatId, 'Yangi test nomini kiriting:');
      bot.answerCallbackQuery(query.id);
    }
  });
}

module.exports = { registerCreateTest };
