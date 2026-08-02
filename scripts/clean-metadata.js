const fs = require('fs');
const path = require('path');
const { buildData, METADATA_PATH, ROOT } = require('./build-static-data');

const BLACKLIST_TERMS = [
  '微博视频',
  '晒单',
  '转赞评',
  '投放',
  '付邮送',
  'PB SET',
  '客服',
  '代发',
  '发放',
  '售后',
  '改地址',
  '举报',
  '公告'
];

const KNOWN_THEMES = [
  { theme: '横店见面会', date: '2025-08-05', tests: ['横店见面会'] },
  { theme: '双人机场', date: '2025-08-15', tests: ['双人机场', '双人机场路透', '机场路透'] },
  { theme: '泰国微博文化交流之夜', date: '2025-08-16', tests: ['泰国微博文化交流之夜', '曼谷微博文化交流之夜'] },
  { theme: '泰国双人见面会', date: '2025-08-17', tests: ['泰国双人见面会', '泰国双人粉丝见面会', '曼谷见面会'] },
  { theme: '清明上河园见面会', date: '2025-09-07', tests: ['清明上河园见面会', '清明上河园'] },
  { theme: '澳门双人见面会', date: '2025-09-13', tests: ['澳门双人见面会', '澳门双人粉丝见面会', '澳门见面会'] },
  { theme: '微博奇遇记', date: '2025-09-14', tests: ['微博奇遇记'] },
  { theme: 'FantasticMan活动', date: '2025-09-22', tests: ['fantasticman', 'fantastic man'] },
  { theme: '巴黎时装周·26春', from: '2026-03-02', to: '2026-03-07', tests: ['展轩首次巴黎时装周', '展轩启程巴黎时装周'] },
  { theme: '巴黎时装周·25秋', from: '2025-10-01', to: '2025-10-08', tests: ['2025巴黎时装周', 'paris fashion week 2025', '巴黎时装周'] },
  { theme: '南京咪豆音乐节', date: '2025-10-02', tests: ['南京咪豆', '咪豆音乐节'] },
  { theme: '宝鸡银杏音乐节', date: '2025-10-04', tests: ['宝鸡银杏', '银杏音乐节'] },
  { theme: '襄阳国潮音乐节', date: '2025-10-08', tests: ['襄阳国潮', '国潮音乐节'] },
  { theme: '扬州枣林湾音乐节', date: '2025-10-18', tests: ['扬州枣林湾', '枣林湾音乐节'] },
  { theme: '25珑骧活动', date: '2025-10-28', tests: ['25珑骧', '2025珑骧', '珑骧', 'longchamp'] },
  { theme: '赣州Z纪元巅峰音乐节', date: '2025-11-15', tests: ['赣州z纪元', 'z纪元巅峰音乐节', '赣州'] },
  { theme: '新加坡微博文化交流之夜', date: '2025-11-16', tests: ['新加坡微博文化交流之夜', '新加坡'] },
  { theme: '代言人影响力盛典红毯', date: '2025-11-29', tests: ['代言人影响力盛典红毯', '代言人影响力盛典'] },
  { theme: 'T风格论坛', date: '2025-12-05', tests: ['t风格论坛', 't 风格论坛'] },
  { theme: '周日下午3点见生日音乐会', date: '2026-01-11', tests: ['周日下午3点见', '生日音乐会'] },
  { theme: 'LOEWE罗意威活动', date: '2026-01-21', tests: ['loewe', '罗意威'] },
  { theme: '深圳奇梦岛开业', date: '2026-02-01', tests: ['奇梦岛'] },
  { theme: '巴黎时装周·26春', from: '2026-03-02', to: '2026-03-07', tests: ['2026巴黎时装周', 'paris fashion week 2026', '巴黎时装周'] },
  { theme: '巴黎世家活动', date: '2026-03-27', tests: ['巴黎世家', 'balenciaga'] },
  { theme: '何日君再来', date: '2026-03-28', tests: ['何日君再来'] },
  { theme: 'QQ音乐巅峰之夜', date: '2026-03-28', tests: ['qq音乐巅峰之夜', '巅峰之夜'] },
  { theme: 'MaisonMargiela看秀', date: '2026-04-01', tests: ['maison margiela', 'maison margirla', 'maisonmargiela'] },
  { theme: 'MaisonMargiela晚宴', date: '2026-04-02', tests: ['maison margiela晚宴', 'maison margirla晚宴', 'maisonmargiela晚宴'] },
  { theme: '26珑骧活动', date: '2026-04-23', tests: ['26珑骧', '2026珑骧', '珑骧', 'longchamp'] },
  { theme: '澳门WIEA国际娱乐盛典', date: '2026-04-26', tests: ['wiea', '国际娱乐盛典'] },
  { theme: '同心结', date: '2026-06-14', tests: ['同心结'] },
  { theme: '米兰巴黎时装周·26夏', from: '2026-06-20', to: '2026-06-27', tests: ['巴黎男装周', '米兰时装周', '男装周', 'dries van noten', 'amiri', 'canali', 'milano calling', 'pfw. amiri', 'milan fashion week'] },
  { theme: '搜狐扫楼', date: '2026-07-03', tests: ['搜狐扫楼'] },
  { theme: '巴黎高定周·26夏', from: '2026-07-04', to: '2026-07-12', tests: ['巴黎高定周', '巴黎高定', '高定时装周', 'couture week', 'rahul mishra', 'ronald van der kemp', 'maison psyche'] }
];

function normalize(value) {
  return String(value || '').normalize('NFKC').toLowerCase();
}

function searchText(record) {
  return normalize([
    record.text,
    record.theme,
    ...(Array.isArray(record.tags) ? record.tags : [])
  ].join('\n'));
}

function containsAny(haystack, terms) {
  return terms.some((term) => haystack.includes(normalize(term)));
}

function isBlacklisted(record) {
  const text = normalize(record.text);
  if (BLACKLIST_TERMS.some((term) => text.includes(normalize(term)))) return true;
  return text.includes(normalize('愚人节')) && !text.includes(normalize('展丞'));
}

function parseDateParts(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return '';
  if (y < 2020 || y > 2030 || m < 1 || m > 12 || d < 1 || d > 31) return '';
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return '';
  return [y, String(m).padStart(2, '0'), String(d).padStart(2, '0')].join('-');
}

function stripHeaderLines(record) {
  const author = normalize(record.author).trim();
  return normalize(record.text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== author)
    .filter((line) => line !== '展丞超话')
    .filter((line) => line !== '已编辑')
    .filter((line) => !line.startsWith('来自 '))
    .filter((line) => !/^\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2}$/.test(line))
    .filter((line) => !/^(今天|昨天|前天|\d+\s*小时前|刚刚)/.test(line))
    .join('\n');
}

function extractDates(record) {
  const body = stripHeaderLines(record);
  const dates = [];
  const add = (date) => {
    if (date && !dates.includes(date)) dates.push(date);
  };

  for (const match of body.matchAll(/\b(20\d{2})\s*[./\-年·]\s*(\d{1,2})\s*[./\-月·]\s*(\d{1,2})\s*日?/g)) {
    add(parseDateParts(match[1], match[2], match[3]));
  }

  for (const match of body.matchAll(/\b(20\d{2})(\d{2})(\d{2})\b/g)) {
    add(parseDateParts(match[1], match[2], match[3]));
  }

  for (const match of body.matchAll(/\b(2[5-9])(\d{2})(\d{2})\b/g)) {
    add(parseDateParts(`20${match[1]}`, match[2], match[3]));
  }

  for (const match of body.matchAll(/\b(\d{1,2})\s*[./\-]\s*(\d{1,2})\s*[./\-]\s*(20\d{2})\b/g)) {
    add(parseDateParts(match[3], match[2], match[1]));
  }

  return dates;
}

function dateInRange(date, from, to) {
  return date && date >= from && date <= to;
}

function ruleMatchesDate(rule, date) {
  if (rule.date) return date === rule.date;
  if (rule.from && rule.to) return dateInRange(date, rule.from, rule.to);
  return false;
}

function recordDates(record) {
  return Array.from(new Set([...extractDates(record), record.shootDate].filter(Boolean)));
}

function knownThemeFor(record) {
  const search = searchText(record);
  const dates = recordDates(record);

  for (const rule of KNOWN_THEMES) {
    if (containsAny(search, rule.tests || [])) {
      const matchingDate = dates.find((date) => ruleMatchesDate(rule, date));
      if (matchingDate) return { theme: rule.theme, date: rule.date || matchingDate };
      if (!dates.length) return { theme: rule.theme, date: rule.date || '' };
    }
  }

  for (const rule of KNOWN_THEMES) {
    const matchingDate = dates.find((date) => ruleMatchesDate(rule, date));
    if (matchingDate) return { theme: rule.theme, date: rule.date || matchingDate };
  }

  return null;
}

function applyMetadataRules(record) {
  const known = knownThemeFor(record);
  const dates = extractDates(record);
  const theme = known ? known.theme : '';
  const shootDate = known?.date || dates[0] || '';
  return {
    ...record,
    shootDate,
    theme
  };
}

function removeFiles(recordsToDelete, keptRecords, dryRun) {
  const keptFiles = new Set(keptRecords.flatMap((record) => record.imageFiles || []));
  const filesToDelete = Array.from(new Set(
    recordsToDelete.flatMap((record) => record.imageFiles || []).filter((imageFile) => !keptFiles.has(imageFile))
  ));
  const missingFiles = [];
  const deletedFiles = [];

  for (const imageFile of filesToDelete) {
    const absolutePath = path.join(ROOT, imageFile);
    if (!fs.existsSync(absolutePath)) {
      missingFiles.push(imageFile);
      continue;
    }
    if (!dryRun) fs.unlinkSync(absolutePath);
    deletedFiles.push(imageFile);
  }

  return { deletedFiles, missingFiles };
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const metadata = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8'));
  const recordsToDelete = metadata.filter(isBlacklisted);
  const keptRecords = metadata.filter((record) => !isBlacklisted(record)).map(applyMetadataRules);
  const fileResult = removeFiles(recordsToDelete, keptRecords, dryRun);

  if (!dryRun) {
    fs.writeFileSync(METADATA_PATH, `${JSON.stringify(keptRecords, null, 2)}\n`);
    buildData(keptRecords);
  }

  const result = {
    dryRun,
    beforeRecords: metadata.length,
    afterRecords: keptRecords.length,
    removedRecords: recordsToDelete.length,
    removedImages: fileResult.deletedFiles.length,
    missingImages: fileResult.missingFiles.length
  };
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  BLACKLIST_TERMS,
  KNOWN_THEMES,
  applyMetadataRules,
  extractDates,
  isBlacklisted,
  knownThemeFor
};
