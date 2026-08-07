# 小红书官方数据采集规则

用于把小红书官方账号图文笔记并入 `official-metadata.json`，与微博官方数据在同一个「官方」页面展示。

## 账号范围

- 展轩
- 刘轩丞
- 展轩工作室

刘轩丞的小红书发布账号统一显示为 `刘轩丞`，不沿用微博账号名里的 `刘轩丞-`。

## 采集边界

1. 进入账号主页，从最新笔记开始按页面顺序取数。
2. 跳过视频笔记，只保留图文笔记。
3. 全量采集时，滚动账号主页直到页面到底，累计去重所有可见卡片。
4. 增量采集时，从最新卡片开始扫描，遇到已存在于 `official-metadata.json` 的 `noteId` 或 `postUrl` 后停止向旧内容扩展。
5. 图文笔记内的所有图片都要采集，不能只采封面。
6. 不采集大图样本，正式入库只使用缩略图展示资源。
7. 图片目标大小为单张不超过 `100000 bytes`。

## 字段规则

- `platform`: 固定为 `xiaohongshu`
- `sourceType`: 本人账号为 `xhs-person`，工作室为 `xhs-studio`
- `author`: 按页面展示账号名；刘轩丞小红书统一写 `刘轩丞`
- `postUrl`: 小红书官方笔记链接，保底为 `https://www.xiaohongshu.com/explore/{noteId}`
- `webUrl`: 可选；如果采集时能从 PC 搜索结果/卡片点击流拿到带 `xsec_token` 的笔记链接，保存完整 URL
- `postDate`: 优先使用详情页可归一化日期
- `postTimeText`: 保存页面原始发布时间文本，例如 `3小时前北京`、`07-24江苏`
- `ipLocation`: 从发布时间后面的地区提取
- `text`: 笔记正文，不包含评论区内容
- `tags`: 只提取笔记正文里 `#` 后面的 tag，不从评论区或推荐词提取
- `imageFiles`: 指向复制后的 `official-images/xhs/...` 本地图片
- `rawPicNum`: 笔记实际采集图片数量

相对时间、无年份日期和 `编辑于` 日期需要记录采集参照时间。无年份日期按采集参照年份归一化；例如 `编辑于 07-08` 在 2026 年采集时归一化为 `2026-07-08`，并把 `publishDatePrecision` 标记为推断来源。

## 图片规则

1. 优先尝试小红书较小 WebP 规格。
2. 如果 CDN 小规格返回 403，则下载详情页实际暴露的图片 URL。
3. 下载后检查大小，超过 `100000 bytes` 的图片用本地压缩降到限制内。
4. 压缩后允许从 WebP 转为 JPEG。
5. 不在 metadata 中保存签名 CDN 图片 URL；笔记页跳转 URL 可以保存 PC 打开所需的 `xsec_token`，但不要把它当成长期稳定凭证。
6. 导入官方数据前，把图片复制到 `official-images/xhs/{accountKey}/{noteId}/NN.ext`。

## PC 跳转规则

小红书裸链接 `https://www.xiaohongshu.com/explore/{noteId}` 在 PC 浏览器里经常会出现“当前笔记暂时无法浏览，请打开小红书 App 扫码查看”。更可靠的 PC 链接通常来自站内搜索或信息流卡片点击后的 URL，形如：

```text
https://www.xiaohongshu.com/explore/{noteId}?xsec_token=...&xsec_source=pc_search
```

后续采集时：

1. 优先从账号页/搜索结果真实点击图文卡片，记录跳转后的完整 URL 到 `webUrl`。
2. 如果只能拿到裸 `noteId`，仍写入 `postUrl`，前端会保留官方链接，但 PC 端可能要求 App 扫码。
3. 不建议默认跳第三方解析站；除非临时人工排查，否则正式图库入口保持官方域名。

## 导入流程

采集目录放在 `docs/records/`，形如：

```bash
docs/records/xhs-capture-incremental-YYYYMMDD-HHMM/metadata.json
docs/records/xhs-capture-all-notes-YYYYMMDD-HHMM/metadata.json
```

导入官方数据：

```bash
node scripts/import-xhs-capture.js docs/records/xhs-capture-incremental-YYYYMMDD-HHMM/metadata.json
npm run build:data
```

全量重建小红书数据时才使用：

```bash
node scripts/import-xhs-capture.js docs/records/xhs-capture-all-notes-YYYYMMDD-HHMM/metadata.json --replace-all-xhs
npm run build:data
```

导入成功后，脚本默认删除采集目录同级的 `images/` 原始/中间图片，只保留 `metadata.json`、详情 JSON、卡片 JSON 等过程记录；正式页面只引用复制后的 `official-images/xhs/`。如需临时排查图片处理问题，可显式加 `--keep-capture-images`，排查结束后仍需删除该目录。

导入脚本会：

- 复制图片到 `official-images/xhs/`
- 把小红书笔记转换为官方 metadata 记录
- 按 `postUrl` / `noteId` 去重导入小红书记录，避免重复导入
- 删除采集归档里的原始/中间图片目录，避免大量过程图片进入 Git
- 重新生成后由官方页面读取 `js/official-data.js`

已完成的小红书全量基线和采集结果见 `docs/records/xhs-collection-log.md`。

## 增量流程

1. 读取 `official-metadata.json` 里已有小红书 `noteId` 和 `postUrl` 作为去重集合。
2. 依次打开展轩、刘轩丞、展轩工作室主页，从最新卡片开始累计新卡片。
3. 对每个账号，一旦遇到已入库的 `noteId` / `postUrl`，即可停止继续扫描该账号的更旧内容。
4. 新卡片进入详情页判断类型：视频跳过，图文采集正文、发布时间、tag 和全部正文图片。
5. 图片下载后压缩到单张不超过 `100000 bytes`，导入前保留在本轮 `docs/records/xhs-capture-incremental-*` 目录。
6. 运行导入脚本，默认按增量合并，把新增图文复制到 `official-images/xhs/{accountKey}/{noteId}/NN.ext`，并写入 `official-metadata.json`；不要在增量更新时使用 `--replace-all-xhs`。
7. 导入脚本成功复制正式图片后，删除采集目录里的 `images/` 原始/中间图片，只保留 JSON 记录。
8. 运行 `npm run build:data` 或等价 bundled Node 命令，重建 `js/data.js` 与 `js/official-data.js`。
9. 审计新增与全量结果：缺失图片、零字节、超 `100000 bytes`、重复 `noteId`、重复 `postUrl`、生成数据缺失都必须为 0。
10. 确认导入和审计通过后，更新 `index.html` footer 中的 `Last updated: YYYY/MM/DD` 为本次采集完成日期。

## 校验

导入后至少检查：

```bash
find official-images/xhs -type f | wc -l
node -e "const d=require('./official-metadata.json'); console.log(d.filter(x=>x.platform==='xiaohongshu').length)"
npm run build:data
```

正式全量基线结果归档在 `docs/records/xhs-collection-log.md`。
