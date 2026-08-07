const fs = require('fs');
const path = require('path');
const { buildData, METADATA_PATH, ROOT } = require('./build-static-data');
const { loadAppConfig } = require('./config');

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

const KNOWN_THEMES = loadAppConfig().themes.matchRules || [];

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
