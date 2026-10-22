// Liệt kê các nhóm Lark mà bot đã được thêm vào, để lấy chat_id: npm run list-chats
require('dotenv').config();
const { listChats } = require('../src/lark');

listChats()
  .then((data) => {
    const items = data.items || [];
    if (!items.length) {
      console.log('Bot chưa ở trong nhóm nào. Hãy thêm bot vào nhóm Lark rồi chạy lại.');
      return;
    }
    for (const c of items) console.log(`${c.chat_id}\t${c.name}`);
  })
  .catch((e) => { console.error('❌', e.message); process.exit(1); });
