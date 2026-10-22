require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const haravan = require('./haravan');
const lark = require('./lark');
const { buildOrderCard } = require('./orderCard');

const app = express();
const PORT = process.env.PORT || 3000;

// Chống gửi trùng khi Haravan retry webhook (giữ 2000 id gần nhất)
const seen = new Set();
function alreadySeen(key) {
  if (seen.has(key)) return true;
  seen.add(key);
  if (seen.size > 2000) seen.delete(seen.values().next().value);
  return false;
}

app.get('/', (_req, res) => res.send('haravan-lark-notify đang chạy ✅'));

// ---------- 1. Shop cài app: chuyển sang Haravan để đăng nhập & cấp quyền ----------
const nonces = new Set();
app.get('/haravan/install', (_req, res) => {
  const nonce = crypto.randomBytes(16).toString('hex');
  nonces.add(nonce);
  res.redirect(haravan.buildInstallUrl(nonce));
});

// ---------- 2. Haravan trả về code (form_post) → đổi token → subscribe webhook ----------
app.post('/haravan/callback', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const { code, id_token, error } = req.body;
    if (error) return res.status(400).send(`Haravan báo lỗi: ${error}`);
    if (!code) return res.status(400).send('Thiếu code');

    const claims = id_token ? haravan.decodeIdToken(id_token) : {};
    if (claims.nonce && !nonces.delete(claims.nonce)) {
      return res.status(400).send('Nonce không hợp lệ, hãy cài lại từ /haravan/install');
    }

    const token = await haravan.exchangeCode(code);
    const info = token.id_token ? haravan.decodeIdToken(token.id_token) : claims;
    const orgId = String(info.orgid || info.org_id || 'unknown');

    haravan.saveShop(orgId, {
      org_name: info.orgname,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: token.expires_in ? Date.now() + token.expires_in * 1000 : null,
    });

    await haravan.subscribeWebhook(token.access_token);
    console.log(`[install] Shop ${orgId} (${info.orgname || ''}) đã cài & subscribe webhook`);
    res.send(`<h3>Đã kết nối shop ${info.orgname || orgId} với Lark ✅</h3><p>Từ giờ mỗi đơn hàng mới sẽ được báo vào nhóm Lark.</p>`);
  } catch (err) {
    console.error('[callback]', err);
    res.status(500).send('Cài app thất bại: ' + err.message);
  }
});

// ---------- 3. Xác thực URL webhook (Haravan gọi GET khi anh bấm đăng ký trên Partner) ----------
app.get('/haravan/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.HARAVAN_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(401);
});

// ---------- 4. Nhận webhook ----------
// Dùng raw body để tính HMAC chính xác
app.post('/haravan/webhook', express.raw({ type: '*/*', limit: '5mb' }), (req, res) => {
  const hmac = req.get('X-Haravan-Hmacsha256');
  const topic = req.get('X-Haravan-Topic');
  const orgId = req.get('X-Haravan-Org-Id');

  const validHmac = haravan.verifyHmac(req.body, hmac);
  const fallbackToken = process.env.HARAVAN_ACCESS_TOKEN || haravan.getShop(orgId)?.access_token;

  if (!validHmac) {
    console.warn(`[webhook] Sai HMAC (topic=${topic}, org=${orgId}) ${haravan.hmacDebug(req.body, hmac)}`);
    // Không có token để tự kiểm chứng đơn qua API thì từ chối như cũ
    if (topic !== 'orders/create' || !fallbackToken) return res.sendStatus(401);
  }

  // Trả 200 ngay (Haravan chỉ chờ 5 giây), xử lý phía sau
  res.sendStatus(200);

  let payload;
  try { payload = JSON.parse(req.body.toString('utf8')); } catch { return; }

  if (!validHmac) {
    // Payload không đáng tin: chỉ lấy id rồi đọc đơn thật từ API Haravan
    if (!payload?.id) return;
    haravan.fetchOrder(payload.id, fallbackToken)
      .then((order) => {
        // Chỉ báo đơn vừa tạo, tránh bị gửi lại đơn cũ bằng request giả
        if (!order) return;
        if (Date.now() - new Date(order.created_at) > 6 * 60 * 60 * 1000) {
          return console.warn(`[orders/create] Bỏ qua đơn cũ ${order.name} (HMAC sai)`);
        }
        return handleNewOrder(orgId, order);
      })
      .catch((e) => console.error('[orders/create] Không xác minh được đơn qua API:', e.message));
  } else if (topic === 'orders/create') {
    handleNewOrder(orgId, payload).catch((e) => console.error('[orders/create]', e.message));
  } else if (topic === 'app/uninstalled') {
    console.log(`[webhook] Shop ${orgId} đã gỡ app`);
  } else {
    console.log(`[webhook] Bỏ qua topic ${topic}`);
  }
});

async function handleNewOrder(orgId, order) {
  // Khoá theo id đơn (không theo header org) để header giả không lách được chống trùng
  if (alreadySeen(String(order.id))) return;

  // Domain admin dạng <ten-shop>.myharavan.com để gắn nút "Xem đơn" (không bắt buộc)
  const shopDomain = process.env.HARAVAN_SHOP_DOMAIN || null;

  const card = buildOrderCard(order, shopDomain);
  await lark.sendCard(process.env.LARK_CHAT_ID, card);
  console.log(`[orders/create] Đã báo Lark đơn ${order.name}`);
}

app.listen(PORT, () => {
  console.log(`Server chạy tại cổng ${PORT}`);
  console.log(`  Cài app cho shop:  ${process.env.PUBLIC_URL}/haravan/install`);
  console.log(`  Webhook URL:       ${process.env.PUBLIC_URL}/haravan/webhook`);
});
