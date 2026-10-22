# haravan-lark-notify

Khách đặt đơn trên Haravan → webhook `orders/create` → server này → gửi card vào nhóm Lark.

```
Haravan ──(POST orders/create, ký HMAC)──▶ /haravan/webhook ──▶ Lark bot ──▶ Nhóm Lark
```

## 1. Cài đặt

Yêu cầu Node.js ≥ 18.

```bash
npm install
cp .env.example .env   # rồi điền các giá trị
```

## 2. Chuẩn bị Lark

1. Vào **Lark Developer Console** → app của anh → **Features → Bot**: bật Bot.
2. **Permissions & Scopes**: thêm `im:message:send_as_bot` (gửi tin) và `im:chat:readonly` (để liệt kê nhóm). Tạo version mới và publish app.
3. Mở nhóm Lark muốn nhận thông báo → **Settings → Bots → Add bot** → chọn app.
4. Điền `LARK_APP_ID`, `LARK_APP_SECRET` vào `.env`, rồi chạy:
   ```bash
   npm run list-chats      # in ra chat_id dạng oc_xxx của các nhóm có bot
   ```
   Chép `chat_id` vào `LARK_CHAT_ID`.
5. Kiểm tra: `npm run test:lark` → nhóm sẽ nhận 1 card đơn hàng mẫu.

> Dùng Feishu (Trung Quốc) thì đổi `LARK_DOMAIN=https://open.feishu.cn`.

## 3. Chuẩn bị Haravan (Partner)

1. Server phải có **URL HTTPS public** (VPS + domain, hoặc test bằng `ngrok http 3000`). Điền vào `PUBLIC_URL`.
2. Trong trang app trên Haravan Partner:
   - **Redirect URL / Login callback**: `{PUBLIC_URL}/haravan/callback`
   - **Webhook**: Callback URL `{PUBLIC_URL}/haravan/webhook`, Verify token = giá trị `HARAVAN_VERIFY_TOKEN`.
     Bấm đăng ký → Haravan gọi GET kèm `hub.challenge`, server tự trả về để xác thực.
   - Sau khi xác thực, tải lại trang và **tick topic `orders/create`** (nên tick thêm `app/uninstalled`).
3. Điền `HARAVAN_APP_ID`, `HARAVAN_APP_SECRET` vào `.env`. Scope cần có `com.read_orders` và `wh_api`.

## 4. Chạy & kết nối shop

```bash
npm start
```

Mở trình duyệt: `{PUBLIC_URL}/haravan/install` → đăng nhập Haravan bằng tài khoản chủ shop → đồng ý cấp quyền.
Server sẽ lấy access token và gọi `POST https://webhook.haravan.com/api/subscribe` để bật webhook cho shop.
Token được lưu ở `data/shops.json`.

Xong. Đặt thử 1 đơn trên website → Lark nhận card gồm mã đơn, thời gian đặt, họ tên, SĐT, địa chỉ, sản phẩm.

## Deploy lên VPS (Ubuntu/Debian)

1. Trỏ bản ghi DNS **A** của domain (vd `notify.shopcuaanh.vn`) về IP của VPS.
2. Upload code (kèm `.env`, không cần `node_modules`) lên VPS, rồi chạy:
   ```bash
   sudo bash deploy/setup.sh notify.shopcuaanh.vn email@cuaanh.com
   ```
   Script cài Node 20, pm2, Nginx, xin HTTPS Let's Encrypt, tự sửa `PUBLIC_URL` và chạy app ở `/opt/haravan-lark-notify`.
3. Trên Haravan Partner khai báo Callback/Webhook theo URL script in ra, rồi mở `https://<domain>/haravan/install`.

Cập nhật code về sau: chép file mới vào `/opt/haravan-lark-notify` rồi `pm2 restart haravan-lark`.

## Ghi chú vận hành

- Mọi webhook đều được kiểm tra header `X-Haravan-Hmacsha256` (HMAC-SHA256 base64 của raw body, khoá = App Secret); sai chữ ký trả 401.
- Server trả 200 ngay rồi mới gửi Lark, vì Haravan chỉ chờ 5 giây và **tự xoá subscription sau 19 lần lỗi liên tiếp**.
- Có chống gửi trùng khi Haravan retry (theo `org_id + order.id`, lưu trong bộ nhớ).
- Muốn card có nút "Xem đơn trên Haravan", điền `HARAVAN_SHOP_DOMAIN` (vd `shopcuaanh.myharavan.com`).
- Chạy lâu dài nên dùng `pm2 start src/server.js --name haravan-lark` hoặc Docker, đặt sau Nginx có HTTPS.

## Cấu trúc

```
src/server.js      Express: /haravan/install, /haravan/callback, /haravan/webhook
src/haravan.js     OAuth, subscribe webhook, verify HMAC, lưu token shop
src/lark.js        tenant_access_token (có cache) + gửi message card
src/orderCard.js   Dựng card Lark từ payload đơn hàng
scripts/           test-lark.js, list-chats.js
```
