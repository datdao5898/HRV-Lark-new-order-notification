// Cấu hình pm2: pm2 start ecosystem.config.js
// Chỉ chạy 1 instance vì nonce cài app và bộ chống gửi trùng nằm trong bộ nhớ
module.exports = {
  apps: [
    {
      name: 'haravan-lark',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      env: { NODE_ENV: 'production' },
    },
  ],
};
