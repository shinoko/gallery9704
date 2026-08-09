const fs = require('fs');
const path = require('path');
const { isBlacklisted } = require('./clean-metadata');
const { loadAppConfig } = require('./config');
const { deletedPostUrlSet } = require('./deleted-records');

const ROOT = path.resolve(__dirname, '..');
const RECORDS_DIR = path.join(ROOT, 'docs', 'records');
const INDEX_PATH = path.join(ROOT, 'index.html');
const TODAY = formatDate(new Date());
const HAS_SINCE_ARG = process.argv.includes('--since');
const HAS_END_ARG = process.argv.includes('--end');
const REGULAR_INCREMENTAL = !HAS_SINCE_ARG && !HAS_END_ARG;
const SINCE_DATE = HAS_SINCE_ARG
  ? process.argv[process.argv.indexOf('--since') + 1]
  : readFooterDate() || TODAY;
const END_DATE = HAS_END_ARG
  ? process.argv[process.argv.indexOf('--end') + 1]
  : TODAY;
const MAX_PAGES = Number(process.argv.includes('--max-pages')
  ? process.argv[process.argv.indexOf('--max-pages') + 1]
  : 5);
const API_DIR = process.argv.includes('--api-dir')
  ? path.resolve(process.cwd(), process.argv[process.argv.indexOf('--api-dir') + 1])
  : '';

const ACCOUNTS = loadAppConfig().accounts.weiboCollectionAccounts || [];
const EDIT_PLACEHOLDER_RE = /【待编辑】|【待替换】|待编辑|待替换/;
const EDITED_RE = /【已编辑】|已编辑/;

function loadExisting(dataType) {
  const filename = dataType === 'official' ? 'official-metadata.json' : 'metadata.json';
  const metadata = JSON.parse(fs.readFileSync(path.join(ROOT, filename), 'utf8'));
  return new Set(metadata.map((record) => record.postUrl).filter(Boolean));
}

function readFooterDate() {
  if (!fs.existsSync(INDEX_PATH)) return '';
  const html = fs.readFileSync(INDEX_PATH, 'utf8');
  const match = html.match(/Last updated:\s*(\d{4})\/(\d{2})\/(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function updateFooterDate(dateText) {
  if (!fs.existsSync(INDEX_PATH)) return false;
  const html = fs.readFileSync(INDEX_PATH, 'utf8');
  const displayDate = dateText.replace(/-/g, '/');
  const nextHtml = html.replace(/Last updated:\s*\d{4}\/\d{2}\/\d{2}/, `Last updated: ${displayDate}`);
  if (nextHtml === html) return false;
  fs.writeFileSync(INDEX_PATH, nextHtml);
  return true;
}

function loadExistingIndex(dataType) {
  const filename = dataType === 'official' ? 'official-metadata.json' : 'metadata.json';
  const metadata = JSON.parse(fs.readFileSync(path.join(ROOT, filename), 'utf8'));
  const byPostUrl = new Map();
  const byMblogId = new Map();
  for (const record of metadata) {
    if (record.postUrl) byPostUrl.set(record.postUrl, record);
    for (const id of [record.mblogId, record.mid, record.bid].filter(Boolean)) {
      byMblogId.set(String(id), record);
    }
  }
  return { byPostUrl, byMblogId };
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

function formatDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function formatTime(date) {
  return `${formatDate(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function parsePostDate(mblog) {
  const parsed = new Date(mblog.created_at);
  if (!Number.isNaN(parsed.getTime())) {
    return { postDate: formatDate(parsed), postTimeText: formatTime(parsed) };
  }
  const text = String(mblog.created_at || '');
  const md = text.match(/(\d{1,2})-(\d{1,2})\s+(\d{1,2}:\d{2})/);
  if (md) return { postDate: `2026-${md[1].padStart(2, '0')}-${md[2].padStart(2, '0')}`, postTimeText: text };
  return { postDate: '', postTimeText: text };
}

function cleanImageUrl(url) {
  return String(url || '')
    .replace('/large/', '/orj360/')
    .replace('/mw2000/', '/orj360/')
    .replace('/orj960/', '/orj360/')
    .replace('/orj480/', '/orj360/');
}

function imageUrl(pic) {
  return cleanImageUrl(pic?.large?.url || pic?.url || pic?.bmiddle?.url || pic?.original?.url || '');
}

function bidOf(mblog) {
  return mblog.bid || mblog.mblogid || mblog.idstr || String(mblog.id || '');
}

function safeFilenamePart(value) {
  return String(value || '')
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function isRepost(mblog) {
  return Boolean(mblog.retweeted_status) || /\/\/@|转发微博|来自 微博抽奖平台/.test(stripHtml(mblog.text));
}

function hasEditPlaceholder(text) {
  return EDIT_PLACEHOLDER_RE.test(stripHtml(text));
}

function hasEditedMarker(text) {
  return EDITED_RE.test(stripHtml(text));
}

function isVideo(mblog) {
  const pageInfo = mblog.page_info || {};
  const text = stripHtml(mblog.text);
  return /微博视频|的微博视频|播放视频/.test(text)
    || pageInfo.type === 'video'
    || pageInfo.object_type === 'video'
    || Boolean(pageInfo.media_info);
}

function skipReason(mblog, record) {
  const visibleType = mblog.visible?.type;
  if (visibleType && visibleType !== 0) return 'not_public';
  if (isRepost(mblog)) return 'repost';
  if (isVideo(mblog)) return 'video';
  if (!record.imageUrls.length) return 'no_weibo_image';
  if ((mblog.pic_num || 0) > record.imageUrls.length) return 'incomplete_pic_list';
  if (isBlacklisted(record)) return 'blacklist';
  return '';
}

function toRecord(account, mblog) {
  const { postDate, postTimeText } = parsePostDate(mblog);
  const bid = bidOf(mblog);
  const imageUrls = (mblog.pics || []).map(imageUrl).filter(Boolean);
  const extByUrl = (url) => {
    const clean = url.split('?')[0].toLowerCase();
    if (clean.endsWith('.webp')) return 'webp';
    if (clean.endsWith('.png')) return 'png';
    return 'jpg';
  };
  const imageDir = account.dataType === 'official' ? 'official-images' : 'images';
  const imageFiles = imageUrls.map((url, index) => (
    `${imageDir}/${postDate}_${safeFilenamePart(account.name)}_${safeFilenamePart(bid)}_${String(index + 1).padStart(2, '0')}.${extByUrl(url)}`
  ));
  return {
    author: account.name,
    authorUrl: `https://weibo.com/u/${account.uid}`,
    postUrl: `https://weibo.com/${account.uid}/${bid}`,
    postDate,
    postTimeText,
    text: stripHtml(mblog.text),
    imageUrls,
    imageFiles,
    sourceType: account.sourceType || '',
    collectionSource: `m-weibo-container-api-incremental-${TODAY.replace(/-/g, '')}`,
    collectionAccountUid: account.uid,
    collectionAccountName: account.name,
    mblogId: String(mblog.idstr || mblog.id || ''),
    mid: String(mblog.mid || mblog.idstr || mblog.id || ''),
    bid,
    rawPicNum: mblog.pic_num || imageUrls.length
  };
}

function detailCacheCandidates(mblog) {
  const ids = [
    mblog?.idstr,
    mblog?.id,
    mblog?.mid,
    mblog?.mblogid,
    mblog?.bid
  ].filter(Boolean).map(String);
  const uniqueIds = [...new Set(ids)];
  return uniqueIds.flatMap((id) => [
    `status-${id}.json`,
    `detail-${id}.json`,
    `detail-${id}-images.json`
  ]);
}

function parseJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function extractDetailMblog(payload) {
  if (!payload || typeof payload !== 'object') return null;
  return payload.mblog
    || payload.status
    || payload.data?.mblog
    || payload.data?.status
    || (payload.data?.id || payload.data?.idstr || payload.data?.mid ? payload.data : null)
    || (payload.id || payload.idstr || payload.mid ? payload : null);
}

function applyDetailImages(mblog, payload) {
  if (!mblog || !Array.isArray(payload?.imageUrls)) return mblog;
  return {
    ...mblog,
    pics: payload.imageUrls.map((url) => ({ url })),
    pic_num: payload.imageUrls.length
  };
}

async function fetchDetailMblog(mblog) {
  if (API_DIR) {
    for (const filename of detailCacheCandidates(mblog)) {
      const filePath = path.join(API_DIR, filename);
      if (!fs.existsSync(filePath)) continue;
      const payload = parseJsonFile(filePath);
      const detailMblog = extractDetailMblog(payload);
      if (detailMblog) return { mblog: applyDetailImages(detailMblog, payload), source: filePath };
      if (Array.isArray(payload?.imageUrls)) return { mblog: null, imageOnly: payload, source: filePath };
    }
    return { mblog: null, source: '', error: 'needs_detail_cache' };
  }

  const id = mblog?.idstr || mblog?.id || mblog?.mid || mblog?.bid;
  if (!id) return { mblog: null, source: '', error: 'missing_detail_id' };
  const url = `https://m.weibo.cn/statuses/show?id=${encodeURIComponent(String(id))}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Referer: `https://m.weibo.cn/status/${id}`
    }
  });
  if (!response.ok) return { mblog: null, source: url, error: `HTTP ${response.status}` };
  const payload = await response.json();
  const detailMblog = extractDetailMblog(payload);
  return { mblog: detailMblog, source: url, error: detailMblog ? '' : 'detail_payload_without_mblog' };
}

function recordSummary(account, record, extra = {}) {
  return {
    account: account.name,
    uid: account.uid,
    dataType: account.dataType,
    postUrl: record.postUrl,
    postDate: record.postDate,
    mblogId: record.mblogId,
    mid: record.mid,
    bid: record.bid,
    text: record.text,
    imageCount: record.imageUrls.length,
    ...extra
  };
}

function originalPostUrlFromMblog(mblog) {
  const uid = mblog?.user?.id || mblog?.user?.idstr || '';
  const bid = bidOf(mblog);
  return uid && bid ? `https://weibo.com/${uid}/${bid}` : '';
}

function hasSameImages(left, right) {
  const leftImages = (left.imageUrls || []).map(cleanImageUrl);
  const rightImages = (right.imageUrls || []).map(cleanImageUrl);
  return leftImages.length === rightImages.length
    && leftImages.every((url, index) => url === rightImages[index]);
}

async function reviewEditPlaceholder(account, item, deletedUrls) {
  const detail = await fetchDetailMblog(item.mblog);
  if (!detail.mblog) {
    return {
      ...item.summary,
      reviewStatus: detail.error || 'needs_detail_cache',
      detailSource: detail.source,
      detailImageCount: detail.imageOnly?.imageUrls?.length || 0
    };
  }

  const replacementRecord = toRecord(account, detail.mblog);
  const reason = skipReason(detail.mblog, replacementRecord);
  const stillPlaceholder = hasEditPlaceholder(replacementRecord.text);
  const reviewStatus = stillPlaceholder
    ? 'still_contains_placeholder'
    : reason
      ? `detail_not_collectable:${reason}`
      : deletedUrls.has(replacementRecord.postUrl)
        ? 'manual-delete'
        : 'ready_to_replace';

  return {
    ...item.summary,
    reviewStatus,
    detailSource: detail.source,
    detailText: replacementRecord.text,
    detailImageCount: replacementRecord.imageUrls.length,
    replacementRecord: reviewStatus === 'ready_to_replace' ? replacementRecord : undefined
  };
}

async function reviewEditedRepostOriginal(account, item, existingIndex) {
  const detail = await fetchDetailMblog(item.originalMblog);
  if (!detail.mblog) {
    return {
      ...item.summary,
      reviewStatus: detail.error || 'needs_original_detail_cache',
      detailSource: detail.source,
      detailImageCount: detail.imageOnly?.imageUrls?.length || 0
    };
  }

  const originalAccount = {
    ...account,
    uid: String(detail.mblog.user?.id || detail.mblog.user?.idstr || item.originalUid || account.uid),
    name: detail.mblog.user?.screen_name || item.originalAuthor || account.name
  };
  const replacementRecord = toRecord(originalAccount, detail.mblog);
  const existingRecord = existingIndex.byPostUrl.get(replacementRecord.postUrl)
    || existingIndex.byMblogId.get(replacementRecord.mblogId)
    || existingIndex.byMblogId.get(replacementRecord.mid)
    || existingIndex.byMblogId.get(replacementRecord.bid);
  if (!existingRecord) {
    return {
      ...item.summary,
      reviewStatus: 'original_not_collected',
      detailSource: detail.source,
      detailText: replacementRecord.text,
      detailImageCount: replacementRecord.imageUrls.length,
      replacementRecord
    };
  }

  const textChanged = stripHtml(existingRecord.text) !== replacementRecord.text;
  const imageChanged = !hasSameImages(existingRecord, replacementRecord);
  return {
    ...item.summary,
    reviewStatus: textChanged || imageChanged ? 'existing_needs_update' : 'collected_latest',
    detailSource: detail.source,
    existingPostUrl: existingRecord.postUrl,
    existingImageCount: (existingRecord.imageUrls || existingRecord.imageFiles || []).length,
    detailText: replacementRecord.text,
    detailImageCount: replacementRecord.imageUrls.length,
    changedFields: [
      textChanged ? 'text' : '',
      imageChanged ? 'imageUrls' : ''
    ].filter(Boolean),
    replacementRecord: textChanged || imageChanged ? replacementRecord : undefined
  };
}

async function fetchPage(account, page) {
  if (API_DIR) {
    const filePath = path.join(API_DIR, `${account.uid}-${page}.json`);
    if (!fs.existsSync(filePath)) return { ok: 1, data: { cards: [] } };
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  const url = `https://m.weibo.cn/api/container/getIndex?type=uid&value=${account.uid}&containerid=107603${account.uid}&page=${page}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Referer: `https://m.weibo.cn/u/${account.uid}`
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
  return response.json();
}

function extractMblogs(payload) {
  const cards = payload?.data?.cards || [];
  return cards.map((card) => card.mblog).filter(Boolean);
}

function summarizeReasons(items) {
  return items.reduce((acc, item) => {
    acc[item.reason] = (acc[item.reason] || 0) + 1;
    return acc;
  }, {});
}

async function collectAccount(account, existingUrls, deletedUrls, existingIndex) {
  const seen = new Set();
  const records = [];
  const skipped = [];
  const retry = [];
  const editReview = [];
  const repostOriginalReview = [];
  const scannedPages = [];
  let existingCount = 0;
  let oldCount = 0;
  let total = 0;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const payload = await fetchPage(account, page);
    total = payload?.data?.cardlistInfo?.total || total;
    const mblogs = extractMblogs(payload);
    if (!mblogs.length) break;

    const pageStats = { page, mblogs: 0, recent: 0, kept: 0, skipped: 0, existing: 0, old: 0, minDate: '', maxDate: '' };
    for (const mblog of mblogs) {
      const bid = bidOf(mblog);
      if (!bid || seen.has(bid)) continue;
      seen.add(bid);
      pageStats.mblogs += 1;
      const record = toRecord(account, mblog);
      if (record.postDate) {
        pageStats.minDate = pageStats.minDate ? [pageStats.minDate, record.postDate].sort()[0] : record.postDate;
        pageStats.maxDate = pageStats.maxDate ? [pageStats.maxDate, record.postDate].sort().at(-1) : record.postDate;
      }
      if (record.postDate < SINCE_DATE || record.postDate > END_DATE) {
        oldCount += 1;
        pageStats.old += 1;
        continue;
      }
      if (mblog.retweeted_status && hasEditedMarker(mblog.retweeted_status.text)) {
        const originalMblog = mblog.retweeted_status;
        repostOriginalReview.push({
          mblog: originalMblog,
          originalUid: originalMblog.user?.id || originalMblog.user?.idstr || '',
          originalAuthor: originalMblog.user?.screen_name || '',
          summary: recordSummary(account, record, {
            repostReason: 'retweeted_text_contains_edited',
            repostText: record.text,
            originalPostUrl: originalPostUrlFromMblog(originalMblog),
            originalMblogId: String(originalMblog.idstr || originalMblog.id || ''),
            originalMid: String(originalMblog.mid || originalMblog.idstr || originalMblog.id || ''),
            originalBid: bidOf(originalMblog),
            originalAuthor: originalMblog.user?.screen_name || ''
          })
        });
      }
      if (existingUrls.has(record.postUrl)) {
        existingCount += 1;
        pageStats.existing += 1;
        continue;
      }
      pageStats.recent += 1;
      if (deletedUrls.has(record.postUrl)) {
        skipped.push({ account: account.name, uid: account.uid, postUrl: record.postUrl, postDate: record.postDate, reason: 'manual-delete', text: record.text });
        pageStats.skipped += 1;
        continue;
      }
      if ((record.imageUrls.length || mblog.pic_num) && hasEditPlaceholder(record.text)) {
        editReview.push({
          mblog,
          summary: recordSummary(account, record, {
            reviewReason: 'image_text_contains_edit_placeholder',
            matchedPlaceholders: [
              record.text.includes('待编辑') ? '待编辑' : '',
              record.text.includes('待替换') ? '待替换' : ''
            ].filter(Boolean)
          })
        });
        skipped.push({ account: account.name, uid: account.uid, postUrl: record.postUrl, postDate: record.postDate, reason: 'pending_edit_placeholder_review', text: record.text });
        pageStats.skipped += 1;
        continue;
      }
      const reason = skipReason(mblog, record);
      if (reason === 'incomplete_pic_list') {
        retry.push({ account: account.name, uid: account.uid, postUrl: record.postUrl, postDate: record.postDate, reason, rawPicNum: record.rawPicNum, listedImages: record.imageUrls.length });
        pageStats.skipped += 1;
      } else if (reason) {
        skipped.push({ account: account.name, uid: account.uid, postUrl: record.postUrl, postDate: record.postDate, reason, text: record.text });
        pageStats.skipped += 1;
      } else {
        records.push(record);
        pageStats.kept += 1;
      }
    }
    scannedPages.push(pageStats);
    if (pageStats.recent === 0 && (pageStats.old > 0 || pageStats.existing > 0)) break;
  }

  const reviewedEditItems = [];
  for (const item of editReview) {
    const reviewed = await reviewEditPlaceholder(account, item, deletedUrls);
    reviewedEditItems.push(reviewed);
    if (reviewed.replacementRecord) records.push(reviewed.replacementRecord);
  }

  const reviewedRepostItems = [];
  for (const item of repostOriginalReview) {
    reviewedRepostItems.push(await reviewEditedRepostOriginal(account, item, existingIndex));
  }

  return {
    summary: {
      name: account.name,
      uid: account.uid,
      mode: 'incremental',
      dataType: account.dataType,
      total,
      pageCount: scannedPages.length,
      scannedUnique: seen.size,
      keptNew: records.length,
      skippedNew: skipped.filter((item) => item.account === account.name).length,
      retryNew: retry.filter((item) => item.account === account.name).length,
      editReviewCount: reviewedEditItems.length,
      editReviewResolved: reviewedEditItems.filter((item) => item.reviewStatus === 'ready_to_replace').length,
      repostOriginalReviewCount: reviewedRepostItems.length,
      repostOriginalNeedsUpdate: reviewedRepostItems.filter((item) => item.reviewStatus === 'existing_needs_update' || item.reviewStatus === 'original_not_collected').length,
      existingCount,
      oldCount,
      excludedReasons: summarizeReasons(skipped.filter((item) => item.account === account.name)),
      scannedPages,
      imageCount: records.reduce((sum, record) => sum + record.imageUrls.length, 0)
    },
    records,
    skipped,
    retry,
    editReview: reviewedEditItems,
    repostOriginalReview: reviewedRepostItems
  };
}

async function main() {
  fs.mkdirSync(RECORDS_DIR, { recursive: true });
  const existing = {
    station: loadExisting('station'),
    official: loadExisting('official')
  };
  const deleted = {
    station: deletedPostUrlSet('station'),
    official: deletedPostUrlSet('official')
  };
  const existingIndex = {
    station: loadExistingIndex('station'),
    official: loadExistingIndex('official')
  };
  const outputs = {
    station: { records: [], skipped: [], retry: [], editReview: [], repostOriginalReview: [], accounts: [] },
    official: { records: [], skipped: [], retry: [], editReview: [], repostOriginalReview: [], accounts: [] }
  };

  for (const account of ACCOUNTS) {
    const result = await collectAccount(account, existing[account.dataType], deleted[account.dataType], existingIndex[account.dataType]);
    outputs[account.dataType].records.push(...result.records);
    outputs[account.dataType].skipped.push(...result.skipped);
    outputs[account.dataType].retry.push(...result.retry);
    outputs[account.dataType].editReview.push(...result.editReview);
    outputs[account.dataType].repostOriginalReview.push(...result.repostOriginalReview);
    outputs[account.dataType].accounts.push(result.summary);
    for (const record of result.records) existing[account.dataType].add(record.postUrl);
    console.error(`${account.name}: kept=${result.summary.keptNew}, skipped=${result.summary.skippedNew}, retry=${result.summary.retryNew}, editReview=${result.summary.editReviewCount}, repostOriginalReview=${result.summary.repostOriginalReviewCount}`);
  }

  const stamp = TODAY.replace(/-/g, '');
  const files = {
    station: path.join(RECORDS_DIR, `weibo-station-incremental-candidate-${stamp}.json`),
    official: path.join(RECORDS_DIR, `official-weibo-incremental-candidate-${stamp}.json`),
    progress: path.join(RECORDS_DIR, `weibo-incremental-progress-${stamp}.json`)
  };

  for (const dataType of ['station', 'official']) {
    const output = outputs[dataType];
    fs.writeFileSync(files[dataType], `${JSON.stringify({
      collectedAt: new Date().toISOString(),
      executionDate: TODAY,
      sinceDate: SINCE_DATE,
      endDate: END_DATE,
      regularIncremental: REGULAR_INCREMENTAL,
      dataType,
      collectionSource: `m-weibo-container-api-incremental-${stamp}`,
      summary: {
        accounts: output.accounts,
        totalRecords: output.records.length,
        totalImages: output.records.reduce((sum, record) => sum + record.imageUrls.length, 0),
        retryCount: output.retry.length,
        skippedCount: output.skipped.length,
        editReviewCount: output.editReview.length,
        editReviewResolved: output.editReview.filter((item) => item.reviewStatus === 'ready_to_replace').length,
        repostOriginalReviewCount: output.repostOriginalReview.length,
        repostOriginalNeedsUpdate: output.repostOriginalReview.filter((item) => item.reviewStatus === 'existing_needs_update' || item.reviewStatus === 'original_not_collected').length
      },
      records: output.records,
      retry: output.retry,
      editReview: output.editReview,
      repostOriginalReview: output.repostOriginalReview,
      replacementRecords: [
        ...output.editReview,
        ...output.repostOriginalReview
      ].map((item) => item.replacementRecord).filter(Boolean),
      skipped: output.skipped
    }, null, 2)}\n`);
  }

  const footerUpdated = REGULAR_INCREMENTAL ? updateFooterDate(TODAY) : false;
  if (footerUpdated) files.footer = INDEX_PATH;

  fs.writeFileSync(files.progress, `${JSON.stringify({
    collectedAt: new Date().toISOString(),
    sinceDate: SINCE_DATE,
    endDate: END_DATE,
    regularIncremental: REGULAR_INCREMENTAL,
    executionDate: TODAY,
    footerUpdated,
    accounts: [...outputs.station.accounts, ...outputs.official.accounts],
    files
  }, null, 2)}\n`);
  console.log(JSON.stringify(files, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
