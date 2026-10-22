// Gửi thử 1 card đơn hàng giả vào Lark (nhóm hoặc cá nhân theo LARK_CHAT_ID): npm run test:lark
require('dotenv').config();
const { sendCard } = require('../src/lark');
const { buildOrderCard } = require('../src/orderCard');

const fakeOrder = {
  id: 1234567,
  name: '#100123',
  created_at: new Date().toISOString(),
  total_price: 685000,
  total_discounts: 50000,
  financial_status: 'pending',
  gateway: 'COD',
  note: 'Giao giờ hành chính',
  shipping_lines: [{ price: 35000 }],
  shipping_address: {
    name: 'Nguyễn Văn A', phone: '0901234567',
    address1: '182 Lê Đại Hành', ward: 'Phường 15', district: 'Quận 11', province: 'Hồ Chí Minh',
  },
  line_items: [
    { title: 'Áo thun basic', variant_title: 'Trắng / L', quantity: 2, price: 200000 },
    { title: 'Quần jean slim', variant_title: 'Default Title', quantity: 1, price: 300000 },
  ],
};

sendCard(process.env.LARK_CHAT_ID, buildOrderCard(fakeOrder, 'demo.myharavan.com', process.env.SHOP_NAME))
  .then(() => console.log('✅ Đã gửi card thử vào Lark'))
  .catch((e) => { console.error('❌', e.message); process.exit(1); });
