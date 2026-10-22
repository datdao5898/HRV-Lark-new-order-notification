# Hướng dẫn cài đặt trên VPS (dành cho người/agent cài đặt)

App: Node.js (Express) nhận webhook đơn hàng mới từ Haravan và gửi card vào Lark.
Đích: chạy thường trực bằng pm2, sau Nginx, có HTTPS, tại `/opt/haravan-lark-notify`.

## Thông tin cần có trước khi cài
- **DOMAIN**: domain/subdomain dành cho app, bản ghi DNS A đã trỏ về IP VPS này.
- **EMAIL**: email đăng ký Let's Encrypt.
- File `.env` đã nằm trong thư mục code (đã điền key Haravan + Lark). **Không in nội dung `.env` ra log/chat.**

## Yêu cầu
- Ubuntu/Debian, quyền root/sudo, cổng 80 và 443 mở ra Internet.
- Nếu có firewall (ufw / security group của nhà cung cấp): mở 80, 443; **không** cần mở 3000.

## Cài đặt (1 lệnh)
Trong thư mục code vừa upload:
```bash
sudo bash deploy/setup.sh <DOMAIN> <EMAIL>
```
Script sẽ: cài Node 20 + pm2 + Nginx + Certbot → chép code vào `/opt/haravan-lark-notify` → đặt `PUBLIC_URL=https://<DOMAIN>` trong `.env` → `npm ci` → chạy pm2 (tự khởi động khi reboot) → cấu hình Nginx → xin HTTPS.

Nếu VPS đã có Nginx phục vụ site khác: script chỉ thêm file `/etc/nginx/sites-available/haravan-lark`, không đụng site cũ. Nếu cổng 3000 đã bị chiếm, đổi `PORT` trong `setup.sh` trước khi chạy.

## Kiểm tra sau khi cài
```bash
curl -s https://<DOMAIN>/                     # phải trả: haravan-lark-notify đang chạy ✅
pm2 status                                    # haravan-lark: online
cd /opt/haravan-lark-notify && npm run test:lark   # Lark nhận 1 card đơn mẫu
pm2 logs haravan-lark --lines 50
```
Kiểm tra xác thực webhook (thay TOKEN bằng giá trị `HARAVAN_VERIFY_TOKEN` trong `.env`):
```bash
curl -s "https://<DOMAIN>/haravan/webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=ok"   # phải trả: ok
```

## Việc chủ shop tự làm sau khi cài (cần đăng nhập, không tự động hoá)
1. Haravan Partner → app → Redirect/Callback URL: `https://<DOMAIN>/haravan/callback`
2. Webhook: Callback URL `https://<DOMAIN>/haravan/webhook`, Verify token = `HARAVAN_VERIFY_TOKEN` → đăng ký → tick topic `orders/create` (và `app/uninstalled`).
3. Mở `https://<DOMAIN>/haravan/install`, đăng nhập chủ shop, đồng ý cấp quyền.
4. Đặt thử 1 đơn → Lark nhận thông báo.

## Vận hành
- Log: `pm2 logs haravan-lark`  ·  Khởi động lại: `pm2 restart haravan-lark`
- Sửa `.env` xong phải `pm2 restart haravan-lark`.
- Token shop lưu ở `/opt/haravan-lark-notify/data/shops.json` – đừng xoá.
- Chỉ chạy **1 instance** (đã cấu hình sẵn trong `ecosystem.config.js`).

## Lỗi thường gặp
| Lỗi | Nguyên nhân / cách xử lý |
|---|---|
| certbot báo lỗi xác thực domain | DNS chưa trỏ đúng IP hoặc cổng 80 bị chặn |
| Lark `230002 Bot/User can NOT be out of the chat` | Bot chưa được thêm vào nhóm `LARK_CHAT_ID` |
| Webhook log `Sai HMAC` | `HARAVAN_APP_SECRET` sai, hoặc webhook đến từ app khác |
| `/haravan/callback` báo lỗi redirect_uri | Callback URL trên Partner chưa khớp `https://<DOMAIN>/haravan/callback` |
