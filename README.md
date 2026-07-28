# 宾果六合彩尾数预测系统

完整 Next.js 15 网站，可直接上传 GitHub 后部署到 Vercel。

## 目录

- `app/page.jsx`：前端页面
- `app/api/history/route.js`：服务端开奖 API
- `app/layout.jsx`：页面布局
- `package.json`：依赖
- `next.config.js`：Next.js 配置

## 数据源

使用开奖1868公开 API，彩种代码 `bingosix`。

- 近期开奖：`/openapi/drawLottery/bingosix/last.kj`
- 按日期历史：`/openapi/drawLottery/bingosix/day/YYYYMMDD.kj`
- `.cc` 失败时自动切换 `.com`
- 最多保留最新 100 期

## 部署

1. 把整个项目上传到 GitHub 仓库根目录。
2. Vercel 导入该仓库。
3. Framework Preset 选择 Next.js（通常自动识别）。
4. 点击 Deploy。

部署后先测试：

`https://你的域名/api/history`

如果正常，应返回 JSON，包含 `ok: true`、`latest`、`historyCount` 和 `history`。
