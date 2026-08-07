# GALLERY9704

原生 HTML/CSS/JavaScript + Node.js 的本地图库项目，用于浏览和维护站姐、本人/工作室、小红书图文数据。

## 常用命令

```bash
npm start
node server.js --no-image
npm run build:data
```

- 本地服务默认地址：`http://127.0.0.1:4182/`
- 使用 `node server.js --no-image` 启动时，页面默认进入维护模式，并打开无图开关。
- 站姐数据源：`metadata.json`
- 官方数据源：`official-metadata.json`
- 生成数据：`js/data.js`、`js/official-data.js`

## 文档入口

- 项目维护入口：[`docs/PROJECT_MAINTENANCE.md`](docs/PROJECT_MAINTENANCE.md)
- 数据清理规则：[`docs/DATA_CLEANING_RULES.md`](docs/DATA_CLEANING_RULES.md)
- 微博采集规则：[`docs/WEIBO_COLLECTION_RULES.md`](docs/WEIBO_COLLECTION_RULES.md)
- 小红书采集规则：[`docs/XHS_COLLECTION_RULES.md`](docs/XHS_COLLECTION_RULES.md)
- 采集记录归档：[`docs/records/README.md`](docs/records/README.md)

## 目录原则

根目录保留项目入口、运行文件、正式数据源和应用代码。规则文档放在 `docs/`，采集候选、扫描进度、下载报告、审计清单、重试清单和历史采集日志放在 `docs/records/`。
