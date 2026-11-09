// Dựng Lark message card từ payload đơn hàng Haravan
// Hiện: mã đơn, thời gian đặt, họ tên, SĐT, địa chỉ, nguồn đơn, sản phẩm
const { describeSource, landingPage } = require('./orderSource');

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

// shopDomain: domain admin để gắn nút "Xem đơn"; shopLabel: tên shop hiện trên tiêu đề
function buildOrderCard(order, shopDomain, shopLabel) {
  const c = order.customer || {};
  const ship = order.shipping_address || order.billing_address || {};
  const name =
    ship.name?.trim() ||
    [c.last_name, c.first_name].filter(Boolean).join(' ') ||
    'Khách lẻ';
  const phone = ship.phone || c.phone || order.phone || '—';
  const address = [ship.address1, ship.ward, ship.district, ship.province]
    .filter(Boolean).join(', ') || '—';

  const items = (order.line_items || [])
    .map((li) => {
      const variant = li.variant_title && li.variant_title !== 'Default Title' ? ` (${li.variant_title})` : '';
      return `• ${li.title}${variant} × ${li.quantity}`;
    })
    .join('\n') || '—';

  const src = describeSource(order, shopDomain, shopLabel);
  const sourceLines = [`**Nguồn:** ${src.icon} ${src.text}${src.details.length ? ` · ${src.details.join(' · ')}` : ''}`];
  const landing = landingPage(order);
  if (landing) sourceLines.push(`**Trang vào đầu tiên:** ${landing}`);

  const adminUrl = order.id && shopDomain
    ? `https://${shopDomain}/admin/orders/${order.id}`
    : null;

  const elements = [
    {
      tag: 'div',
      fields: [
        { is_short: true, text: { tag: 'lark_md', content: `**Mã đơn:**\n${order.name || order.order_number}` } },
        { is_short: true, text: { tag: 'lark_md', content: `**Thời gian đặt:**\n${fmtTime(order.created_at)}` } },
        { is_short: true, text: { tag: 'lark_md', content: `**Họ tên:**\n${name}` } },
        { is_short: true, text: { tag: 'lark_md', content: `**SĐT:**\n${phone}` } },
      ],
    },
    { tag: 'div', text: { tag: 'lark_md', content: `**Địa chỉ:** ${address}` } },
    { tag: 'div', text: { tag: 'lark_md', content: sourceLines.join('\n') } },
    { tag: 'hr' },
    { tag: 'div', text: { tag: 'lark_md', content: `**Sản phẩm:**\n${items}` } },
  ];

  if (adminUrl) {
    elements.push({
      tag: 'action',
      actions: [{ tag: 'button', type: 'primary', text: { tag: 'plain_text', content: 'Xem đơn trên Haravan' }, url: adminUrl }],
    });
  }

  return {
    config: { wide_screen_mode: true },
    header: {
      template: 'green',
      title: { tag: 'plain_text', content: `🛒 Đơn hàng mới ${order.name || ''}${shopLabel ? ` · ${shopLabel}` : ''}`.trim() },
    },
    elements,
  };
}

module.exports = { buildOrderCard };
