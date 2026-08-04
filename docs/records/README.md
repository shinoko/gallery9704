# 文档与采集记录

项目目录和日常维护入口见 [`../PROJECT_MAINTENANCE.md`](../PROJECT_MAINTENANCE.md)。

## 采集记录归档

本目录用于归档微博和小红书采集过程中的候选记录、扫描进度、下载报告、审计清单和重试清单。

根目录只保留运行所需的数据源、前端文件、脚本和规则类文档：

- `metadata.json`
- `official-metadata.json`
- `DATA_CLEANING_RULES.md`
- `WEIBO_COLLECTION_RULES.md`
- `docs/XHS_COLLECTION_RULES.md`

新增采集记录请继续放在本目录，避免根目录混入一次性过程文件。

文件命名建议保留账号、用途和日期，例如：

- `*-candidate-YYYYMMDD.json`：候选微博记录
- `*-progress-YYYYMMDD.json`：扫描进度和剔除原因
- `*-image-download-report-YYYYMMDD.json`：图片下载结果
- `*-audit*.md`：人工审计清单
- `*-retry*.md`：待重试项目
- `xhs-capture-*-YYYYMMDD-HHMM/`：小红书采集过程目录，只保留 `metadata.json`、详情 JSON、卡片 JSON 等正式全量或增量证据；导入成功后删除其中的 `images/` 原始/中间图片，正式图片只保留在 `official-images/xhs/`
