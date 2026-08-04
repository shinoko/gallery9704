# 项目目录与维护指南

本文档是 GALLERY9704 的维护入口。当前项目是原生 HTML/CSS/JavaScript + Node.js 静态服务，不是 React 项目。

## 目录总览

```text
gallery9704/
├── index.html                    页面结构和脚本入口
├── css/style.css                 页面样式
├── js/main.js                    前端交互、筛选、维护模式、图片查看
├── js/data.js                    由 metadata.json 生成的站姐静态数据
├── js/official-data.js           由 official-metadata.json 生成的官方静态数据
├── metadata.json                 站姐数据源
├── official-metadata.json        本人/工作室数据源
├── server.js                     本地静态服务、维护 API、静态导出
├── package.json                  npm 命令
├── scripts/                      数据清理、生成、采集和预览脚本
├── images/                       站姐图片资源，仅在数据或导出涉及图片时访问
├── official-images/              官方图片资源，仅在数据或导出涉及图片时访问
├── docs/
│   ├── PROJECT_MAINTENANCE.md    本文档
│   └── records/                  采集候选、进度、报告、审计和重试记录
├── exports/                      静态导出产物，自动生成，可忽略
├── preview-assets/               预览截图/素材，自动生成，可忽略
├── node_modules/                 npm 依赖，自动生成，可忽略
└── .wrangler/                    Wrangler 缓存或临时文件，可忽略
```

## 根目录文件原则

根目录只放运行必需文件、正式数据源和规则类文档。一次性的采集过程文件统一放到 `docs/records/`，不要把候选 JSON、下载报告、扫描进度或重试清单放回根目录。

正式数据源与生成文件的关系如下：

| 修改目标 | 应修改的文件 | 修改后执行 |
| --- | --- | --- |
| 站姐微博数据 | `metadata.json` | `npm run build:data` |
| 官方/工作室微博数据 | `official-metadata.json` | `npm run build:data` |
| 站姐采集规则 | `WEIBO_COLLECTION_RULES.md` | 无需生成 |
| 小红书官方采集规则 | `docs/XHS_COLLECTION_RULES.md` | 无需生成 |
| 数据清理规则 | `DATA_CLEANING_RULES.md` | 无需生成 |
| 采集过程记录 | `docs/records/` | 无需生成 |

`js/data.js` 和 `js/official-data.js` 是生成文件，正常情况下不要手动编辑；它们会被 `npm run build:data` 或维护页面的保存操作重新生成。

## 按任务选择访问目录

### 功能开发、交互或样式调整

优先访问：

- `index.html`
- `css/style.css`
- `js/main.js`
- `package.json`
- `server.js`（涉及保存、删除、导出或接口时）

通常可以完全忽略：

- `images/`
- `official-images/`
- `docs/records/`
- `exports/`
- `preview-assets/`
- `.wrangler/`

只有在图片路径、图片加载、静态导出或真实素材布局出现问题时，才需要访问两个图片目录。

### 数据清理或字段修订

优先访问：

- `DATA_CLEANING_RULES.md`
- `metadata.json` 或 `official-metadata.json`
- `scripts/clean-metadata.js`
- `scripts/build-static-data.js`

推荐命令：

```bash
npm run clean:data:dry
npm run clean:data
npm run build:data
```

清理微博记录时，注意图片文件可能被多条记录引用。删除数据必须遵守规则文档中的引用检查，不要直接批量删除 `images/` 或 `official-images/`。

### 新增微博采集或重跑下载

优先访问：

- `WEIBO_COLLECTION_RULES.md`
- `scripts/download-candidate-images.js`
- `scripts/merge-candidate-metadata.js`
- `docs/records/`

候选记录、扫描进度和下载报告写入 `docs/records/`。下载器产生的图片路径仍指向 `images/` 或 `official-images/`，这是数据运行关系，不代表图片目录属于文档目录。

### 每次增量更新

每次做数据增量更新时，同时检查微博和小红书两个来源。

微博增量按 `WEIBO_COLLECTION_RULES.md` 执行：先确定本次账号范围和日期 cutoff，只导入本地没有的 `postUrl`，图片下载和合并过程记录放入 `docs/records/`。

小红书增量按 `docs/XHS_COLLECTION_RULES.md` 执行：检查展轩、刘轩丞、展轩工作室三个账号主页，从最新卡片开始向下扫描，遇到已存在于 `official-metadata.json` 的 `noteId` / `postUrl` 后停止继续向旧内容扩展；跳过视频，只导入新增图文笔记及其全部图片。导入后删除采集目录里的原始/中间图片，只保留 JSON 记录和 `official-images/xhs/` 正式图片，然后必须重新生成静态数据并审计缺图、超限、重复和生成数据一致性。

采集、导入、静态数据重建和审计都完成后，更新 `index.html` 页面 footer 里的 `Last updated: YYYY/MM/DD` 为本次更新完成日期。这个日期表示对外页面的数据更新时间，不随未导入的试采集过程变更。

推荐收尾检查：

```bash
npm run build:data
git diff --check
```

如果本机没有全局 `npm` / `node`，使用 Codex bundled Node 执行 `scripts/build-static-data.js` 两次，分别生成 `js/data.js` 和 `js/official-data.js`。

### 发布或检查静态导出

```bash
npm start
npm run export:static
```

导出结果写入 `exports/`。该目录是产物，不是源代码；要改页面，应回到 `index.html`、`css/`、`js/` 或 `server.js`。

## 不同文件的修改风险

| 风险 | 文件 | 说明 |
| --- | --- | --- |
| 低 | `css/style.css` | 一般只影响视觉表现，仍需检查维护模式和移动端 |
| 中 | `index.html`、`js/main.js` | 会影响筛选、弹窗、维护模式和无图模式 |
| 中 | `server.js` | 会影响保存、删除图片、导出和路径安全 |
| 高 | `metadata.json`、`official-metadata.json` | 会改变数据量、筛选项以及图片引用关系 |
| 高 | `scripts/clean-metadata.js`、`scripts/build-static-data.js` | 会影响所有后续数据处理结果 |
| 独立资源 | `images/`、`official-images/` | 只在素材、路径或导出问题中处理 |

## 当前技术基线

- 启动：`npm start`，默认地址 `http://127.0.0.1:4182/`。
- 数据构建：`npm run build:data`。
- 维护数据保存到本地服务 API，并同步生成静态数据文件。
- `exports/`、`preview-assets/`、`node_modules/` 和 `.wrangler/` 都不应作为功能代码修改入口。
