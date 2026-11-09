// Xác định đơn đến từ nguồn nào, dựa trên các trường Haravan tự ghi:
//   utm_source/utm_medium/utm_campaign/utm_content/utm_term  (từ link có gắn UTM)
//   source / landing_site_ref  (kênh bán: web, googleshop, ...)
//   referring_site             (trang khách bấm vào trước khi tới shop)
//   landing_site               (trang đầu tiên khách vào)

// Tên dễ đọc cho các utm_source / tên miền hay gặp
const KNOWN = [
  { re: /^(facebook|fb|meta)$|^facebook/, label: 'Facebook', icon: '📘' },
  { re: /^(instagram|ig)$/, label: 'Instagram', icon: '📸' },
  { re: /^google/, label: 'Google', icon: '🔎' },
  { re: /^tiktok|^tt$/, label: 'TikTok', icon: '🎵' },
  { re: /^zalo/, label: 'Zalo', icon: '💬' },
  { re: /^youtube/, label: 'YouTube', icon: '▶️' },
  { re: /chatgpt|openai/, label: 'ChatGPT', icon: '🤖' },
  { re: /^(bing|microsoft)/, label: 'Bing', icon: '🔎' },
  { re: /^coccoc/, label: 'Cốc Cốc', icon: '🔎' },
  { re: /^shopee/, label: 'Shopee', icon: '🛍' },
  { re: /^(email|e-mail|newsletter|mail)$/, label: 'Email', icon: '✉️' },
];

const PAID_MEDIUM = /^(cpc|ppc|paid|paid[-_ ]?social|ads?|cpm|display|banner|retargeting|remarketing)$/i;

function known(name) {
  const key = String(name || '').toLowerCase().trim();
  return KNOWN.find((k) => k.re.test(key));
}

function hostOf(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return String(url).replace(/^[a-z-]+:\/\//i, '').split('/')[0].replace(/^www\./, '');
  }
}

// Map tên miền giới thiệu → nguồn; android-app://com.google.android.googlequicksearchbox là app Google
function fromReferrer(ref, shopDomain, shopName) {
  if (!ref) return null;
  if (/googlequicksearchbox/.test(ref)) return { icon: '🔎', text: 'Google (tự nhiên, app Google)' };
  const host = hostOf(ref);
  if (!host) return null;
  // Đi từ chính website/admin của shop sang (vd newlite.vn, store.kingcom.com.vn) thì coi như truy cập trực tiếp
  const ownWord = String(shopName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (
    host.endsWith('myharavan.com') ||
    (shopDomain && host === hostOf(`https://${shopDomain}`)) ||
    (ownWord.length >= 4 && host.replace(/[^a-z0-9.]/g, '').split('.').includes(ownWord))
  ) return null;
  // So từng phần của tên miền: l.facebook.com → facebook, m.youtube.com → youtube
  const k = known(host) || host.split('.').map(known).find(Boolean);
  if (k?.icon === '🔎') return { icon: k.icon, text: `${k.label} (tự nhiên)` };
  if (/larksuite|feishu/.test(host)) return { icon: '🔗', text: 'Link chia sẻ trên Lark' };
  if (k) return { icon: k.icon, text: k.label };
  return { icon: '🔗', text: `Từ trang ${host}` };
}

// Trả về { icon, text, details[] }: text là nguồn chính, details là chiến dịch / mẫu QC / từ khoá
function describeSource(order, shopDomain, shopName) {
  const utmSource = (order.utm_source || '').trim();
  const medium = (order.utm_medium || '').trim();
  const details = [];
  // Bỏ chiến dịch trùng tên nguồn (vd link Zalo gắn sẵn utm zalo/zalo/zalo)
  if (order.utm_campaign && order.utm_campaign.toLowerCase() !== utmSource.toLowerCase()) {
    details.push(`chiến dịch: ${order.utm_campaign}`);
  }
  if (order.utm_content) details.push(`mẫu QC: ${order.utm_content}`);
  if (order.utm_term) details.push(`từ khoá: ${order.utm_term}`);

  if (utmSource) {
    const k = known(utmSource);
    const name = k?.label || utmSource;
    const paid = PAID_MEDIUM.test(medium);
    const text = paid ? `${name} Ads` : name;
    const extra = medium && !paid && medium.toLowerCase() !== utmSource.toLowerCase() ? ` (${medium})` : '';
    return { icon: paid ? '📣' : k?.icon || '🔗', text: text + extra, details };
  }

  const channel = String(order.landing_site_ref || order.source || order.source_name || '').toLowerCase();
  if (channel === 'googleshop') return { icon: '🛍', text: 'Google Shopping', details };
  // Đơn không tạo từ website (vd admin tạo tay, POS, sàn): hiện tên kênh
  if (channel && channel !== 'web') return { icon: '🏪', text: `Kênh ${order.source_name || order.source}`, details };

  const ref = fromReferrer(order.referring_site, shopDomain, shopName);
  if (ref) return { ...ref, details };
  return { icon: '↩️', text: 'Truy cập trực tiếp', details };
}

// Trang đầu tiên khách vào, bỏ qua trang chủ
function landingPage(order) {
  const p = String(order.landing_site || '').split('?')[0];
  if (!p || p === '/') return null;
  return p.length > 90 ? `${p.slice(0, 87)}...` : p;
}

module.exports = { describeSource, landingPage };
