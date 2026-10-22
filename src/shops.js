// Danh sách shop Haravan cần theo dõi, đọc từ .env:
//   HARAVAN_ACCESS_TOKEN=...            shop chính  (tên: SHOP_NAME, domain: HARAVAN_SHOP_DOMAIN)
//   HARAVAN_ACCESS_TOKEN_NEWLITE=...    shop thêm   (tên: SHOP_NAME_NEWLITE, domain: HARAVAN_SHOP_DOMAIN_NEWLITE)
function getShops(env = process.env) {
  const shops = [];
  if (env.HARAVAN_ACCESS_TOKEN) {
    shops.push({
      key: 'default',
      name: env.SHOP_NAME || '',
      domain: env.HARAVAN_SHOP_DOMAIN || null,
      token: env.HARAVAN_ACCESS_TOKEN.trim(),
    });
  }
  for (const [k, token] of Object.entries(env)) {
    const m = k.match(/^HARAVAN_ACCESS_TOKEN_([A-Z0-9]+)$/);
    if (!m || !token) continue;
    const suffix = m[1];
    shops.push({
      key: suffix.toLowerCase(),
      name: env[`SHOP_NAME_${suffix}`] || suffix.charAt(0) + suffix.slice(1).toLowerCase(),
      domain: env[`HARAVAN_SHOP_DOMAIN_${suffix}`] || null,
      token: token.trim(),
    });
  }
  return shops;
}

module.exports = { getShops };
