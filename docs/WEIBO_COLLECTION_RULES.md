# 微博增量采集规则

本文档用于后续从微博账号增量采集图片数据。规则由 `DATA_CLEANING_RULES.md` 的删除规则反向整理而来：先判断是否应剔除，再将保留微博写入对应的 metadata 文件。

采集过程文件统一归档在 `docs/records/`：候选记录、扫描进度、下载报告、审计清单和重试清单都放入该目录。根目录仅保留项目入口、正式 metadata 数据源和应用运行文件。

已完成的试采、批量采集、复扫、补采和标签复盘见 `records/weibo-collection-log.md`。

## 数据分区

站姐账号和官方账号分开存储，后续前端展示时按数据类型分别加载。

| 数据类型 | 正式 metadata | 静态数据 | 图片目录 | 说明 |
| --- | --- | --- | --- | --- |
| 站姐账号 | `metadata.json` | `js/data.js` | `images/` | CP 站姐、图站、饭拍图文 |
| 本人/工作室账号 | `official-metadata.json` | `js/official-data.js` | `official-images/` | 展轩、刘轩丞本人及对应工作室 |

官方账号当前清单：

| 账号 | UID | 类型 | 主页 |
| --- | ---: | --- | --- |
| 展轩 | 5080250314 | 本人 | https://weibo.com/u/5080250314 |
| 刘轩丞- | 7904163238 | 本人 | https://weibo.com/u/7904163238 |
| 展轩工作室 | 8019492674 | 工作室 | https://weibo.com/u/8019492674 |
| 刘轩丞工作室 | 4098005675 | 工作室 | https://weibo.com/u/4098005675 |

## 采集前置条件

- 只采集目标账号本人原创微博，不采集转发、引用、抽奖结果、赞过的微博或混入的推荐内容。
- 只采集公开可见的图片微博。
- 只采集正文媒体图片，不把头像、徽章、超话占位图、红包卡片、视频封面等页面装饰资源当成图片。
- 每条数据必须保留完整 `text`、`postUrl`、`imageUrls`、`imageFiles`、`theme`、`tags`、`targetPeople`。
- 用 `postUrl` 做增量去重；已存在的微博不重复写入 `metadata.json`。
- 维护模式中手动删除过的数据记录在 `docs/records/manual-deleted-records.json`；后续增量采集和候选合并都必须把这些 `postUrl` 当作已排除项，不得重新下载图片或再次入库。

## 日期范围

常规增量采集指没有显式传入 `--since` 或 `--end` 的采集。此时脚本必须按页面 footer 的 `Last updated: YYYY/MM/DD` 作为起始日期，结束日期为执行当天，且起止日期都包含在扫描范围内。

- 例如 footer 是 `Last updated: 2026/08/08`，在 `2026-08-09` 执行常规增量时，实际范围是 `2026-08-08` 到 `2026-08-09`。
- 起始日期包含上次执行日期，是为了覆盖上次执行当天后续编辑、新增补图或延迟可见的微博。
- 常规增量成功执行后，候选文件和进度文件都记录 `executionDate`，并把 `index.html` footer 更新为本次执行日期。
- 如果手动传入 `--since` 或 `--end`，视为指定范围采集；脚本尊重传入范围，不自动用 footer 推断完整常规范围，也不自动推进 footer。
- 如果用户口头指定“补 08-03 到今天”这类范围，必须转成明确参数，例如 `--since 2026-08-03 --end 2026-08-09`。

## 必须剔除

微博文案命中 `DATA_CLEANING_RULES.md` 中“删除规则”任一删除词或条件时剔除。删除词列表只维护在 `DATA_CLEANING_RULES.md`，避免两份规则漂移。

补充条件：

- 文案包含 `愚人节` 且不包含 `展丞` 时剔除。
- 文案包含 `赞过的微博` 时剔除。
- 文案包含 `仅粉丝可见`、`粉丝可见`、`关注后可见`、`作者设置`、`暂无权限`、`不可见` 时剔除。
- 卡片是转发或引用包装时剔除。DOM 兜底信号包括：一个卡片里出现多个不同微博链接、`//@`、`转发微博`、`来自 微博抽奖平台`、嵌入 `@账号` 原微博和第二个时间戳。
- 卡片是转发包装、且转发内嵌的原微博文案包含 `已编辑` 时，仍按转发剔除，但必须额外写入 `repostOriginalReview` 清单。采集结束后访问原微博详情，确认原微博是否已经在对应 metadata 中采集到最新 `text` 和图片列表；如未采集或与详情不一致，按详情生成 `replacementRecords`，再人工确认后更新正式数据。
- 卡片是视频微博时剔除。优先信号是 `微博视频`、`播放视频`、`video.weibo.com/show?fid=...`，不要只用 `00:26` 这类时间格式判断视频，因为发布时间也可能是 `13:14`。
- 没有正文媒体图片时剔除。
- `postUrl` 命中 `docs/records/manual-deleted-records.json` 时剔除，剔除原因记为 `manual-delete`。该清单只保留微博或笔记标识、作者、日期和删除时间，不保留本地图片路径；被删图片不需要保留。

## 编辑占位复查

如果图文微博正文包含 `【待编辑】`、`【待替换】`、`待编辑` 或 `待替换`，不要直接把列表卡片数据当成最终数据入库：

- 先把该微博写入候选 JSON 的 `editReview` 清单，跳过原因记为 `pending_edit_placeholder_review`。
- 增量扫描结束后访问微博详情，重新读取完整正文和正文图片。
- 如果详情正文仍包含上述占位词，保持 `still_contains_placeholder`，等待下次增量继续复查。
- 如果详情正文不再包含占位词，且详情微博仍是公开图文、非视频、非转发、图片列表完整，则按详情生成 `replacementRecord`，并放入候选 JSON 的 `replacementRecords`。后续 `download-candidate-images.js` 会下载 `records` 与 `replacementRecords` 的图片，`merge-candidate-metadata.js` 会用 `replacementRecord.imageUrls` / `replacementRecord.imageFiles` 覆盖已存在微博，或补入尚未采集的微博。
- 如果当前网络或浏览器缓存里没有详情证据，状态记为 `needs_detail_cache`；需要用已登录浏览器补存 `status-{mid}.json`、`status-{bid}.json` 或 `detail-{mid}-images.json` 后再跑采集脚本，不得凭列表数据猜测占位是否已改完。

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

### `+N` 图片展开规则

微博主页列表卡片可能只返回前 9 张图片，最后一张缩略图上显示 `+2`、`+3` 等剩余数量。此时不能把列表卡片中的 `pics` 数组长度当成微博的完整图片数。

- `mblog.pic_num` 是该条微博的图片总数；`mblog.pics.length` 只是当前列表接口返回的图片数。
- 当 `pic_num > pics.length` 时，必须进入微博详情页或调用详情数据，提取完整的正文媒体图片，再写入 `imageUrls` 和 `imageFiles`。
- 详情页提取时只保留正文图片，排除头像、会员图标、超话占位图、视频占位图和评论区图片。
- 如果 `pic_num > pics.length` 但详情页显示 `微博视频`、播放时长或视频播放组件，按视频微博剔除，不把视频封面当作图片微博入库。
- 入库前必须满足 `imageUrls.length === imageFiles.length`；如果接口仍只返回部分图片，不得用发布时间、缩略图数量或 `+N` 文本猜测缺失图片，应该将该微博列入重试清单。

图片下载完成后逐条校验：`imageFiles` 文件存在、文件大小大于 0，且下载报告中的 `missing=0`、`zeroBytes=0`。详情页补采的图片仍按 `/orj360/` 缩略图规格保存。

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
- `sourceType`: 官方账号数据需要写入来源类型，`official-person` 表示本人账号，`official-studio` 表示工作室账号；站姐数据可留空。

## 标签提取规则

- 只从正文完整文案 `text` 中提取微博话题，匹配形如 `#话题#` 的片段。
- 每条微博内部的重复标签只保留一次，标签顺序按正文出现顺序保留。
- 标签文本需要做 `NFKC` 规范化，并移除 `\u200b`、`\u200c`、`\u200d`、`\u200e`、`\u200f`、`\ufeff` 等不可见字符。
- 暂时保留原始大小写，例如 `Hello时装周` 和 `hello时装周` 不自动合并；如果后续前端筛选需要统一展示，再单独增加别名归一规则。
- 标签只作为筛选和检索辅助，不反向决定是否采集；是否剔除仍以“必须剔除”和 `DATA_CLEANING_RULES.md` 为准。
- `targetPeople` 与 `tags` 分开维护：只要正文或标签出现 `展轩`，写入 `展轩`；出现 `刘轩丞`，写入 `刘轩丞`。
