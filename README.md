[README.md](https://github.com/user-attachments/files/30438218/README.md)
# 宾果六合彩尾数预测与回测系统

## 文件
- app/page.jsx：前端页面，每20秒自动刷新
- app/api/history/route.js：抓取开奖1868官方公开API
- app/layout.jsx：Next.js布局
- package.json：Next.js 15.5.7 / React 19

## 本地运行
npm install
npm run dev

打开 http://localhost:3000

## 数据源
接口代码：bingosix
公开API：
https://www.kj1868.cc/openapi/drawLottery/bingosix/last.kj?page=1&pageSize=100
备用：
https://www.kj1868.com/openapi/drawLottery/bingosix/last.kj?page=1&pageSize=100

页面每20秒请求本网站 /api/history，由服务端再去抓开奖源，避免浏览器跨域问题。
