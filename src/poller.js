// Quét đơn mới định kỳ bằng private token của từng shop, không cần webhook
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', 'data', 'poll-state.json');
const API = 'https://apis.haravan.com/com/orders.json';

// State dạng { shops: { <key>: { last_order_id } } }; bản cũ { last_order_id } thuộc shop chính
function loadState() {
  let s;
  try { s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return { shops: {} }; }
  if (!s.shops) s = { shops: s.last_order_id ? { default: { last_order_id: s.last_order_id } } : {} };
  return s;
}
function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify({ ...state, updated_at: new Date().toISOString() }, null, 2));
}

async function fetchLatestOrders(token, limit = 50) {
  const res = await fetch(`${API}?limit=${limit}&order=created_at+desc`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Haravan API lỗi ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).orders || [];
}

async function pollShop(shop, state, onOrder) {
  const label = shop.name || shop.key;
  const orders = await fetchLatestOrders(shop.token);
  const shopState = state.shops[shop.key];

  // Lần đầu theo dõi shop này: chỉ ghi nhớ đơn mới nhất, không báo dồn đơn cũ
  if (!shopState) {
    state.shops[shop.key] = { last_order_id: Math.max(0, ...orders.map((o) => Number(o.id))) };
    saveState(state);
    console.log(`[poller] ${label}: bắt đầu theo dõi từ đơn ${orders[0]?.name || '(chưa có đơn)'}`);
    return;
  }

  const fresh = orders
    .filter((o) => Number(o.id) > shopState.last_order_id)
    .sort((a, b) => Number(a.id) - Number(b.id));

  for (const order of fresh) {
    await onOrder(order, shop);
    shopState.last_order_id = Number(order.id);
    saveState(state);
  }
}

// onOrder(order, shop) gửi thông báo; lỗi thì dừng shop đó ở lượt này và thử lại ở lượt sau
function startPolling({ shops, intervalSeconds, onOrder }) {
  let running = false;

  async function tick() {
    if (running) return;
    running = true;
    const state = loadState();
    for (const shop of shops) {
      try {
        await pollShop(shop, state, onOrder);
      } catch (e) {
        console.error(`[poller] ${shop.name || shop.key}:`, e.message);
      }
    }
    running = false;
  }

  console.log(`[poller] Quét ${shops.length} shop (${shops.map((s) => s.name || s.key).join(', ')}) mỗi ${intervalSeconds} giây`);
  tick();
  return setInterval(tick, intervalSeconds * 1000);
}

module.exports = { startPolling };
