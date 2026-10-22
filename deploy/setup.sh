#!/usr/bin/env bash
# Cài app lên VPS Ubuntu/Debian: Node 20 + pm2 + Nginx + HTTPS (Let's Encrypt)
# Chạy bằng root, trong thư mục code đã upload lên VPS:
#   sudo bash deploy/setup.sh notify.shopcuaanh.vn email@cuaanh.com
set -euo pipefail

DOMAIN="${1:?Thiếu domain. VD: sudo bash deploy/setup.sh notify.shopcuaanh.vn email@cuaanh.com}"
EMAIL="${2:?Thiếu email nhận cảnh báo hết hạn SSL}"
APP_DIR=/opt/haravan-lark-notify
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT=3000

[ "$(id -u)" -eq 0 ] || { echo "Hãy chạy bằng sudo/root"; exit 1; }
[ -f "$SRC_DIR/.env" ] || { echo "Chưa có file .env trong $SRC_DIR"; exit 1; }

echo "==> Cài Node.js 20, Nginx, Certbot"
apt-get update -y
apt-get install -y curl ca-certificates nginx certbot python3-certbot-nginx
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
command -v pm2 >/dev/null || npm install -g pm2

echo "==> Chép code vào $APP_DIR"
mkdir -p "$APP_DIR/data"
if [ "$SRC_DIR" != "$APP_DIR" ]; then
  cp -r "$SRC_DIR"/{src,scripts,deploy,package.json,ecosystem.config.js,.env} "$APP_DIR"/
  [ -f "$SRC_DIR/package-lock.json" ] && cp "$SRC_DIR/package-lock.json" "$APP_DIR"/
fi
chmod 600 "$APP_DIR/.env"
sed -i "s|^PUBLIC_URL=.*|PUBLIC_URL=https://$DOMAIN|; s|^PORT=.*|PORT=$PORT|" "$APP_DIR/.env"
cd "$APP_DIR"
if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

echo "==> Chạy app bằng pm2 (tự khởi động lại khi reboot)"
pm2 delete haravan-lark >/dev/null 2>&1 || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null

echo "==> Cấu hình Nginx cho $DOMAIN"
sed "s|__DOMAIN__|$DOMAIN|g; s|__PORT__|$PORT|g" deploy/nginx.conf > /etc/nginx/sites-available/haravan-lark
ln -sf /etc/nginx/sites-available/haravan-lark /etc/nginx/sites-enabled/haravan-lark
nginx -t
systemctl reload nginx

echo "==> Xin chứng chỉ HTTPS"
certbot --nginx -d "$DOMAIN" -m "$EMAIL" --agree-tos --non-interactive --redirect

echo
echo "✅ Xong! Kiểm tra: curl https://$DOMAIN/"
echo "   Webhook URL:  https://$DOMAIN/haravan/webhook"
echo "   Callback URL: https://$DOMAIN/haravan/callback"
echo "   Cài app shop: https://$DOMAIN/haravan/install"
echo "   Xem log:      pm2 logs haravan-lark"
