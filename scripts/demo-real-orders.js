// Lấy N đơn hàng thật gần nhất từ Haravan và gửi card vào Lark để xem thử: npm run demo-orders -- 3
// Token lấy từ HARAVAN_ACCESS_TOKEN (.env) hoặc shop đầu tiên trong data/shops.json (sau khi cài app)
require('dotenv').config();
const { loadShops } = require('../src/haravan');
const { sendCard } = require('../src/lark');
const { buildOrderCard } = require('../src/orderCard');

const limit = Math.min(Number(process.argv[2]) || 3, 20);

async function main() {
  const token = process.env.HARAVAN_ACCESS_TOKEN || Object.values(loadShops())[0]?.access_token;
  if (!token) throw new Error('Chưa có token Haravan: điền HARAVAN_ACCESS_TOKEN vào .env hoặc cài app qua /haravan/install');

  const res = await fetch(`https://apis.haravan.com/com/orders.json?limit=${limit}&order=created_at+desc`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Haravan API lỗi ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const { orders = [] } = await res.json();
  if (!orders.length) return console.log('Shop chưa có đơn nào');

  for (const order of orders) {
    await sendCard(process.env.LARK_CHAT_ID, buildOrderCard(order, process.env.HARAVAN_SHOP_DOMAIN || null));
    console.log(`✅ Đã gửi đơn ${order.name}`);
  }
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
