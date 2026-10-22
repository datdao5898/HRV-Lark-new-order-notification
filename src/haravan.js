// Haravan: OAuth cài app cho shop, đăng ký webhook, xác thực HMAC
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ACCOUNTS = 'https://accounts.haravan.com';
const WEBHOOK_API = 'https://webhook.haravan.com/api/subscribe';
const STORE_FILE = path.join(__dirname, '..', 'data', 'shops.json');

// ---------- Lưu token của shop (file JSON đơn giản) ----------
function loadShops() {
  try { return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')); } catch { return {}; }
}
function saveShop(orgId, info) {
  const shops = loadShops();
  shops[orgId] = { ...shops[orgId], ...info, updated_at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(shops, null, 2));
}
function getShop(orgId) { return loadShops()[orgId]; }

// ---------- OAuth ----------
function buildInstallUrl(nonce) {
  const params = new URLSearchParams({
    response_mode: 'form_post',
    response_type: 'code id_token',
    scope: process.env.HARAVAN_SCOPES,
    client_id: process.env.HARAVAN_APP_ID,
    redirect_uri: `${process.env.PUBLIC_URL}/haravan/callback`,
    nonce,
  });
  return `${ACCOUNTS}/connect/authorize?${params}`;
}

async function exchangeCode(code) {
  const res = await fetch(`${ACCOUNTS}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.HARAVAN_APP_ID,
      client_secret: process.env.HARAVAN_APP_SECRET,
      redirect_uri: `${process.env.PUBLIC_URL}/haravan/callback`,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Đổi code lấy token thất bại: ${res.status} ${JSON.stringify(data)}`);
  }
  return data; // { access_token, refresh_token?, expires_in, id_token, ... }
}

// Lấy orgid (id shop) từ id_token (JWT) – chỉ decode payload
function decodeIdToken(idToken) {
  const payload = idToken.split('.')[1];
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

// ---------- Webhook ----------
// Bật nhận webhook cho shop (các topic đã tick trong trang Partner, vd: orders/create)
async function subscribeWebhook(accessToken) {
  const res = await fetch(WEBHOOK_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Subscribe webhook thất bại: ${res.status} ${text}`);
  return text;
}

function computeHmac(rawBody) {
  return crypto
    .createHmac('sha256', (process.env.HARAVAN_APP_SECRET || '').trim())
    .update(rawBody)
    .digest('base64');
}

// So sánh HMAC SHA256 (base64) của raw body với header X-Haravan-Hmacsha256
function verifyHmac(rawBody, hmacHeader) {
  if (!hmacHeader) return false;
  const a = Buffer.from(computeHmac(rawBody));
  const b = Buffer.from(hmacHeader.trim());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Thông tin chẩn đoán khi HMAC lệch (chỉ in vài ký tự đầu, không lộ secret)
function hmacDebug(rawBody, hmacHeader) {
  const secret = (process.env.HARAVAN_APP_SECRET || '').trim();
  const fp = crypto.createHash('sha256').update(secret).digest('hex').slice(0, 8);
  return `nhận=${String(hmacHeader).slice(0, 8)}… tính=${computeHmac(rawBody).slice(0, 8)}… `
    + `secret_len=${secret.length} secret_fp=${fp} body=${rawBody.length}B`;
}

// Lấy đơn trực tiếp từ API Haravan (dữ liệu đáng tin, không phụ thuộc payload webhook)
async function fetchOrder(orderId, accessToken) {
  const res = await fetch(`https://apis.haravan.com/com/orders/${encodeURIComponent(orderId)}.json`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Haravan API lỗi ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).order;
}

module.exports = {
  buildInstallUrl, exchangeCode, decodeIdToken, subscribeWebhook, verifyHmac, hmacDebug, fetchOrder,
  saveShop, getShop, loadShops,
};
