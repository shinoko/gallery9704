const fs = require('fs');
const path = require('path');
const { isBlacklisted } = require('./clean-metadata');

const ROOT = path.resolve(__dirname, '..');
const RECORDS_DIR = path.join(ROOT, 'docs', 'records');
const TODAY = '2026-08-06';
const SINCE_DATE = process.argv.includes('--since')
  ? process.argv[process.argv.indexOf('--since') + 1]
  : TODAY;
const END_DATE = process.argv.includes('--end')
  ? process.argv[process.argv.indexOf('--end') + 1]
  : TODAY;
const MAX_PAGES = Number(process.argv.includes('--max-pages')
  ? process.argv[process.argv.indexOf('--max-pages') + 1]
  : 5);
const API_DIR = process.argv.includes('--api-dir')
  ? path.resolve(process.cwd(), process.argv[process.argv.indexOf('--api-dir') + 1])
  : '';

const ACCOUNTS = [
  { name: 'Mimosa_0113x0905', uid: '8393384219', dataType: 'station' },
  { name: 'CLING丨0113x0905', uid: '8338137118', dataType: 'station' },
  { name: 'Pointer指针丨0113x0905', uid: '8300677615', dataType: 'station' },
  { name: '失控丨0113x0905', uid: '8019292043', dataType: 'station' },
  { name: '31Kilometres-0113x0905', uid: '8015386194', dataType: 'station' },
  { name: 'RedLight丨0113x0905', uid: '8013999480', dataType: 'station' },
  { name: 'Cosmos_0113x0905', uid: '7934854969', dataType: 'station' },
  { name: 'FoxxBunnyLover_0113x0905', uid: '7686000968', dataType: 'station' },
  { name: '遇见Happiness_0113x0905', uid: '6533117651', dataType: 'station' },
  { name: 'ERhickey-0113X0905', uid: '4079488264', dataType: 'station' },
  { name: 'ElysianSilhouette_0113x0905', uid: '4069898419', dataType: 'station' },
  { name: 'TheMidnightHush丨0113x0905', uid: '9068198836', dataType: 'station' },
  { name: 'WingSync羽翼共振_0113x0905', uid: '7864379003', dataType: 'station' },
  { name: 'ParallelUs丨0113x0905', uid: '8002261474', dataType: 'station' },
  { name: 'NeverBe永不落_0113x0905', uid: '8282610059', dataType: 'station' },
  { name: 'TheFluffTheEar丨0113x0905', uid: '8348303999', dataType: 'station' },
  { name: 'Bond羁绊丨0113x0905', uid: '5892109907', dataType: 'station' },
  { name: 'Spring妙手回春丨0113x0905', uid: '9065471823', dataType: 'station' },
  { name: 'KYOU_521丨0113x0905', uid: '4086481338', dataType: 'station' },
  { name: 'Blush升温丨0113x0905', uid: '8484396430', dataType: 'station' },
  { name: '无风区丨0113x0905', uid: '4076555020', dataType: 'station' },
  { name: 'TALE_0113x0905', uid: '6312977401', dataType: 'station' },
  { name: '69discount_0113x0905', uid: '8250612132', dataType: 'station' },
  { name: '展轩', uid: '5080250314', dataType: 'official', sourceType: 'official-person' },
  { name: '刘轩丞-', uid: '7904163238', dataType: 'official', sourceType: 'official-person' },
  { name: '展轩工作室', uid: '8019492674', dataType: 'official', sourceType: 'official-studio' },
  { name: '刘轩丞工作室', uid: '4098005675', dataType: 'official', sourceType: 'official-studio' }
];

function loadExisting(dataType) {
  const filename = dataType === 'official' ? 'official-metadata.json' : 'metadata.json';
  const metadata = JSON.parse(fs.readFileSync(path.join(ROOT, filename), 'utf8'));
  return new Set(metadata.map((record) => record.postUrl).filter(Boolean));
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

async function collectAccount(account, existingUrls) {
  const seen = new Set();
  const records = [];
  const skipped = [];
  const retry = [];
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
      if (existingUrls.has(record.postUrl)) {
        existingCount += 1;
        pageStats.existing += 1;
        continue;
      }
      pageStats.recent += 1;
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
      existingCount,
      oldCount,
      excludedReasons: summarizeReasons(skipped.filter((item) => item.account === account.name)),
      scannedPages,
      imageCount: records.reduce((sum, record) => sum + record.imageUrls.length, 0)
    },
    records,
    skipped,
    retry
  };
}

async function main() {
  fs.mkdirSync(RECORDS_DIR, { recursive: true });
  const existing = {
    station: loadExisting('station'),
    official: loadExisting('official')
  };
  const outputs = {
    station: { records: [], skipped: [], retry: [], accounts: [] },
    official: { records: [], skipped: [], retry: [], accounts: [] }
  };

  for (const account of ACCOUNTS) {
    const result = await collectAccount(account, existing[account.dataType]);
    outputs[account.dataType].records.push(...result.records);
    outputs[account.dataType].skipped.push(...result.skipped);
    outputs[account.dataType].retry.push(...result.retry);
    outputs[account.dataType].accounts.push(result.summary);
    for (const record of result.records) existing[account.dataType].add(record.postUrl);
    console.error(`${account.name}: kept=${result.summary.keptNew}, skipped=${result.summary.skippedNew}, retry=${result.summary.retryNew}`);
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
      sinceDate: SINCE_DATE,
      endDate: END_DATE,
      dataType,
      collectionSource: `m-weibo-container-api-incremental-${stamp}`,
      summary: {
        accounts: output.accounts,
        totalRecords: output.records.length,
        totalImages: output.records.reduce((sum, record) => sum + record.imageUrls.length, 0),
        retryCount: output.retry.length,
        skippedCount: output.skipped.length
      },
      records: output.records,
      retry: output.retry,
      skipped: output.skipped
    }, null, 2)}\n`);
  }

  fs.writeFileSync(files.progress, `${JSON.stringify({
    collectedAt: new Date().toISOString(),
    sinceDate: SINCE_DATE,
    endDate: END_DATE,
    accounts: [...outputs.station.accounts, ...outputs.official.accounts],
    files
  }, null, 2)}\n`);
  console.log(JSON.stringify(files, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
