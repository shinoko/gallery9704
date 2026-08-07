# 文档与采集记录

项目目录和日常维护入口见 [`../PROJECT_MAINTENANCE.md`](../PROJECT_MAINTENANCE.md)。

## 采集记录归档

本目录用于归档微博和小红书采集过程中的候选记录、扫描进度、下载报告、审计清单、重试清单和历史采集日志。根目录文件原则以 [`../PROJECT_MAINTENANCE.md`](../PROJECT_MAINTENANCE.md) 为准。

文件命名建议保留账号、用途和日期，例如：

- `*-candidate-YYYYMMDD.json`：候选微博记录
- `*-progress-YYYYMMDD.json`：扫描进度和剔除原因
- `*-image-download-report-YYYYMMDD.json`：图片下载结果
- `*-audit*.md`：人工审计清单
- `*-retry*.md`：待重试项目
- `*-collection-log.md`：长期规则文档中移出的历史采集结果
- `xhs-capture-*-YYYYMMDD-HHMM/`：小红书采集过程目录，只保留 `metadata.json`、详情 JSON、卡片 JSON 等正式全量或增量证据；导入成功后删除其中的 `images/` 原始/中间图片，正式图片只保留在 `official-images/xhs/`
