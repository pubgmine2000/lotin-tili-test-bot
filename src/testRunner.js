const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, '..', 'db.json');

function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } 
  catch { return { users: [], results: [] }; }
}
function saveDB(db) { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8'); }

const userFlows = {};

function startTestForUser(bot, chatId, userId, test) {
  let questions = test.questions.slice();
  userFlows[userId] = { chatId, questions, currentIndex:0, answers: [] };
  sendNextQuestion(bot, userId);
}

function sendNextQuestion(bot, userId) {
  const flow = userFlows[userId];
  if (!flow) return;
  if (flow.currentIndex >= flow.questions.length) return finishTest(bot, userId);

  const q = flow.questions[flow.currentIndex];
  const variants = q.variants.slice().sort(()=>Math.random()-0.5);

  const opts = { reply_markup: { inline_keyboard: variants.map(v=>[{ text: v, callback_data: `ANSWER:${v}` }]) } };
  bot.sendMessage(flow.chatId, `Savol ${flow.currentIndex+1}:\n${q.text}\nVaqt: ${q.time || 10} s`, opts);

  flow.timer = setTimeout(() => {
    flow.answers.push({ question: q.text, answer: null, correct:false });
    flow.currentIndex++;
    sendNextQuestion(bot, userId);
  }, (q.time||10)*1000);
}

function handleAnswer(bot, userId, selected) {
  const flow = userFlows[userId];
  if (!flow) return;

  clearTimeout(flow.timer);
  const q = flow.questions[flow.currentIndex];
  const isCorrect = selected === q.correct;
  flow.answers.push({ question: q.text, answer: selected, correct:isCorrect });
  flow.currentIndex++;
  sendNextQuestion(bot, userId);
}

function finishTest(bot, userId) {
  const flow = userFlows[userId];
  if (!flow) return;

  const correctCount = flow.answers.filter(a=>a.correct).length;
  bot.sendMessage(flow.chatId, `Test tugadi! To‘g‘ri javoblar: ${correctCount}/${flow.answers.length}`);

  const db = loadDB();
  db.results = db.results || [];
  db.results.push({ userId, chatId: flow.chatId, answers: flow.answers, date:new Date().toISOString() });
  saveDB(db);

  delete userFlows[userId];
}

function registerTestRunner(bot) {
  bot.on('callback_query', (query) => {
    if (query.data.startsWith('ANSWER:')) {
      const userId = query.from.id;
      handleAnswer(bot, userId, query.data.split(':')[1]);
      bot.answerCallbackQuery(query.id);
    }
  });
}

function startTestForGroup(bot, groupName, test) {
  const db = loadDB();
  const groupUsers = db.users.filter(u=>u.group===groupName);
  groupUsers.forEach(u=> startTestForUser(bot, u.chatId, u.userId, test));
}

module.exports = { registerTestRunner, startTestForUser, startTestForGroup };
