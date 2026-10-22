// Gửi tin nhắn vào Lark bằng bot của Custom App (app_id + app_secret)
const DOMAIN = process.env.LARK_DOMAIN || 'https://open.larksuite.com';

let cachedToken = null;
let tokenExpiresAt = 0;

// Lấy tenant_access_token (hết hạn sau ~2 giờ) và cache lại
async function getTenantToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) return cachedToken;

  const res = await fetch(`${DOMAIN}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      app_id: process.env.LARK_APP_ID,
      app_secret: process.env.LARK_APP_SECRET,
    }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`Lark token lỗi: ${data.code} ${data.msg}`);

  cachedToken = data.tenant_access_token;
  tokenExpiresAt = Date.now() + data.expire * 1000;
  return cachedToken;
}

async function larkApi(method, path, body) {
  const token = await getTenantToken();
  const res = await fetch(`${DOMAIN}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`Lark API lỗi ${path}: ${data.code} ${data.msg}`);
  return data.data;
}

// Đoán loại người nhận: email cá nhân, open_id (ou_xxx) hoặc nhóm (oc_xxx)
function receiveIdType(id) {
  if (id.includes('@')) return 'email';
  if (id.startsWith('ou_')) return 'open_id';
  if (id.startsWith('on_')) return 'union_id';
  return 'chat_id';
}

// Gửi message card vào nhóm chat hoặc nhắn riêng cho một người
async function sendCard(receiveId, card) {
  return larkApi('POST', `/open-apis/im/v1/messages?receive_id_type=${receiveIdType(receiveId)}`, {
    receive_id: receiveId,
    msg_type: 'interactive',
    content: JSON.stringify(card),
  });
}

// Liệt kê các nhóm mà bot đang ở trong đó (để lấy chat_id)
async function listChats() {
  return larkApi('GET', '/open-apis/im/v1/chats?page_size=50');
}

module.exports = { sendCard, listChats, getTenantToken };
