// Quét đơn mới định kỳ bằng private token (HARAVAN_ACCESS_TOKEN), không cần webhook
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', 'data', 'poll-state.json');
const API = 'https://apis.haravan.com/com/orders.json';

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return null; }
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

// onOrder(order) gửi thông báo; lỗi thì dừng lượt này và thử lại ở lượt sau
function startPolling({ token, intervalSeconds, onOrder }) {
  let running = false;

  async function tick() {
    if (running) return;
    running = true;
    try {
      const orders = await fetchLatestOrders(token);
      const state = loadState();

      // Lần đầu chạy: chỉ ghi nhớ đơn mới nhất, không báo dồn đơn cũ
      if (!state) {
        const lastId = Math.max(0, ...orders.map((o) => Number(o.id)));
        saveState({ last_order_id: lastId });
        console.log(`[poller] Bắt đầu theo dõi từ đơn ${orders[0]?.name || '(chưa có đơn)'}`);
        return;
      }

      const fresh = orders
        .filter((o) => Number(o.id) > state.last_order_id)
        .sort((a, b) => Number(a.id) - Number(b.id));

      for (const order of fresh) {
        await onOrder(order);
        state.last_order_id = Number(order.id);
        saveState(state);
      }
    } catch (e) {
      console.error('[poller]', e.message);
    } finally {
      running = false;
    }
  }

  console.log(`[poller] Quét đơn mới mỗi ${intervalSeconds} giây`);
  tick();
  return setInterval(tick, intervalSeconds * 1000);
}

module.exports = { startPolling };
