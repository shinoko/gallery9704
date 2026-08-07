# Weibo Collection Risk Audit

Recorded: 2026-07-31

Sampled accounts:

| Account | UID | URL |
|---|---:|---|
| ParallelUs丨0113x0905 | 8002261474 | https://weibo.com/u/8002261474 |
| NeverBe永不落_0113x0905 | 8282610059 | https://weibo.com/u/8282610059 |
| Bond羁绊丨0113x0905 | 5892109907 | https://weibo.com/u/5892109907 |

## Retry Queue

Follow retry items are maintained in [`weibo-follow-retry-list.md`](weibo-follow-retry-list.md). This audit keeps only the risk observations that informed the collection rules.

## Observed Cases

### Reposts Or Quoted Posts

Observed on:

- Bond羁绊丨0113x0905, post around `4-26 13:59`, includes `查看图片`, then an embedded `@Bond羁绊丨0113x0905` original post and two post timestamps.
- ParallelUs丨0113x0905, lottery result posts from `微博抽奖平台` include the original account/post content inside the same card.

Collection rule:

- Exclude cards that are repost/quote wrappers when the top-level card is not an original image post.
- Strong DOM/text signals: multiple distinct post links inside one article, `来自 微博抽奖平台`, embedded `@account` plus another timestamp, `转发`, `转发微博`, or `//@`.
- Safer API rule if available: only collect the top-level post when `retweeted_status` is absent.

### Liked Posts

Existing archive rules already mention excluding cards containing `赞过的微博`. This marker was not found in the three sampled homepages, but it can appear in mixed feeds/group feeds.

Collection rule:

- Exclude any card whose visible text contains `赞过的微博`.
- If API data is available, exclude feed items whose reason/context indicates liked content rather than author-published content.

### No Image Posts

Observed on:

- ParallelUs丨0113x0905, `2-16 17:00` fan-red-packet post.
- NeverBe永不落_0113x0905, `7-8 01:48` SVIP upgrade post.

Important caveat:

- The page DOM still contains avatar, badge, super-topic, and decoration images. Counting all `<img>` tags is not enough.

Collection rule:

- Count only post media images, not avatar/badge/decorative images.
- Treat cards with no `wx*.sinaimg.cn`/`ww*.sinaimg.cn` post-media image, no gallery media container, and no `查看图片`/`长图` signal as non-image posts.

### Video Posts

Observed on:

- ParallelUs丨0113x0905, `1-21 21:26`, text contains `微博视频`, `播放视频`, duration `00:26`, and view count.
- NeverBe永不落_0113x0905, `1-15 16:34`, text contains `微博视频`, `播放视频`, duration `04:08`.

Collection rule:

- Exclude cards with `微博视频`, `播放视频`, a video URL such as `video.weibo.com/show?fid=...`, or a duration pattern like `00:26`.
- If a card has both pictures and video, treat it as video content unless the project explicitly wants video covers.

### Fans-Only Posts

Observed on:

- NeverBe永不落_0113x0905, `5-5 00:00`, visible marker `仅粉丝可见`.

Collection rule:

- Exclude cards containing `仅粉丝可见`, `粉丝可见`, `关注后可见`, `作者设置`, `暂无权限`, or `不可见`.
- Even if visible after following, keep these out of the public archive to avoid unstable access and privacy-sensitive collection.

## Practical Extraction Notes

- Prefer source/API fields over pure DOM text when possible: `retweeted_status`, media list, video metadata, and visibility flags are more reliable than visual text.
- For browser DOM fallback, parse article cards separately, then apply exclusions before downloading images.
- Do not treat all images in an article as downloadable media; filter out avatars, badges, icons, super-topic placeholders, and decoration assets.
- Keep full original `text`, `postUrl`, `imageUrls`, `imageFiles`, `theme`, and `tags` in metadata after filtering, consistent with the existing archive convention.
