// Lấy N đơn hàng thật gần nhất từ Haravan và gửi card vào Lark để xem thử:
//   npm run demo-orders -- 3            (shop chính)
//   npm run demo-orders -- 3 newlite    (shop có HARAVAN_ACCESS_TOKEN_NEWLITE)
require('dotenv').config();
const { loadShops } = require('../src/haravan');
const { getShops } = require('../src/shops');
const { sendCard } = require('../src/lark');
const { buildOrderCard } = require('../src/orderCard');

const limit = Math.min(Number(process.argv[2]) || 3, 20);
const shopKey = (process.argv[3] || 'default').toLowerCase();

async function main() {
  let shop = getShops().find((s) => s.key === shopKey);
  if (!shop && shopKey === 'default') {
    // Chưa có private token: dùng token shop đã cài app qua OAuth (data/shops.json)
    const token = Object.values(loadShops())[0]?.access_token;
    if (token) shop = { token, name: process.env.SHOP_NAME || '', domain: process.env.HARAVAN_SHOP_DOMAIN || null };
  }
  if (!shop) throw new Error(`Chưa có token cho shop "${shopKey}" trong .env`);

  const res = await fetch(`https://apis.haravan.com/com/orders.json?limit=${limit}&order=created_at+desc`, {
    headers: { Authorization: `Bearer ${shop.token}` },
  });
  if (!res.ok) throw new Error(`Haravan API lỗi ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const { orders = [] } = await res.json();
  if (!orders.length) return console.log('Shop chưa có đơn nào');

  for (const order of orders) {
    await sendCard(process.env.LARK_CHAT_ID, buildOrderCard(order, shop.domain, shop.name));
    console.log(`✅ Đã gửi đơn ${order.name}`);
  }
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
