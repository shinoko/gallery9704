# 微博增量采集规则

本文档用于后续从站姐账号增量采集微博图片数据。规则由 `DATA_CLEANING_RULES.md` 的删除规则反向整理而来：先判断是否应剔除，再将保留微博写入 `metadata.json`。

## 本次试采账号

| 账号 | UID | 主页 |
| --- | ---: | --- |
| TheMidnightHush丨0113x0905 | 9068198836 | https://weibo.com/u/9068198836 |

本次从主页可见微博中采集到 7 条候选卡片，按规则剔除 1 条含 `公告` 的开站微博，保留 6 条图片微博，下载图片 13 张。

## 采集前置条件

- 只采集站姐本人原创微博，不采集转发、引用、抽奖结果、赞过的微博或混入的推荐内容。
- 只采集公开可见的图片微博。
- 只采集正文媒体图片，不把头像、徽章、超话占位图、红包卡片、视频封面等页面装饰资源当成图片。
- 每条数据必须保留完整 `text`、`postUrl`、`imageUrls`、`imageFiles`、`theme`、`tags`、`targetPeople`。
- 用 `postUrl` 做增量去重；已存在的微博不重复写入 `metadata.json`。

## 必须剔除

微博文案命中 `DATA_CLEANING_RULES.md` 中任一删除词时剔除：

- `微博视频`
- `晒单`
- `转赞评`
- `投放`
- `付邮送`
- `PB SET`
- `客服`
- `代发`
- `发放`
- `售后`
- `改地址`
- `举报`
- `公告`

补充条件：

- 文案包含 `愚人节` 且不包含 `展丞` 时剔除。
- 文案包含 `赞过的微博` 时剔除。
- 文案包含 `仅粉丝可见`、`粉丝可见`、`关注后可见`、`作者设置`、`暂无权限`、`不可见` 时剔除。
- 卡片是转发或引用包装时剔除。DOM 兜底信号包括：一个卡片里出现多个不同微博链接、`//@`、`转发微博`、`来自 微博抽奖平台`、嵌入 `@账号` 原微博和第二个时间戳。
- 卡片是视频微博时剔除。优先信号是 `微博视频`、`播放视频`、`video.weibo.com/show?fid=...`，不要只用 `00:26` 这类时间格式判断视频，因为发布时间也可能是 `13:14`。
- 没有正文媒体图片时剔除。

## 图片识别

正文图片通常来自：

- `wx*.sinaimg.cn`
- `ww*.sinaimg.cn`

本地只保存缩略图以节省空间。下载时优先使用 `/orj360/` 规格；如果源 URL 是 `/large/`、`/mw2000/`、`/orj960/`、`/orj480/`，下载器应转为 `/orj360/` 后保存。

需要排除的图片：

- 头像和封面：`tvax*.sinaimg.cn`、`crop.*`
- 徽章或会员图标：`vip_`、`svip_`
- 超话和默认占位图：`timeline_card_*`、`super_default`
- 红包、活动卡片、按钮和图标类装饰资源

## 字段规则

- `author`: 微博账号名。
- `authorUrl`: `https://weibo.com/u/{uid}`。
- `postUrl`: 微博详情链接。
- `postDate`: 微博发布时间对应日期。当前主页 DOM 只显示 `1-24 16:55` 这类格式时，按当前采集年份补全年份。
- `postTimeText`: 保留主页显示的原始发布时间文本。
- `shootDate`: 只记录文案中主动写出的拍摄或活动日期，不用发布时间填充。
- `theme`: 依据 `DATA_CLEANING_RULES.md` 的已知主题表匹配；无法确认时留空。
- `targetPeople`: 文案或标签出现 `展轩`、`刘轩丞` 时写入对应人物。
- `tags`: 提取 `#...#` 标签，去掉不可见 BOM 字符。
- `imageUrls`: 下载前的原图 URL。
- `imageFiles`: 本地图片文件路径，建议格式为 `images/{postDate}_{author}_{mid}_{序号}.jpg`。

## 本次采集结果

候选记录保存在：

- `themidnighthush-collection-candidate.json`

图片下载报告保存在：

- `themidnighthush-image-download-report.json`

已剔除样本：

- `QnIKOChkR`：文案含 `开站公告`，命中 `公告` 删除词。

保留样本：

- `QrMsi237T`
- `QoBVKhO70`
- `QnZmgm888`
- `QnXyrccMX`
- `QnRIl54yB`
- `QnQoYzivj`
