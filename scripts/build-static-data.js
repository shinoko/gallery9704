const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const METADATA_PATH = path.join(ROOT, 'metadata.json');
const DATA_PATH = path.join(ROOT, 'js', 'data.js');

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
}

function normalizePlatform(record) {
  return record.platform === 'xiaohongshu' ? 'xiaohongshu' : 'weibo';
}

function formatLabel(record) {
  return [record.author, record.postDate].filter(Boolean).join(' · ');
}

function toGalleryRecord(record, index) {
  const people = Array.isArray(record.targetPeople) ? record.targetPeople : [];
  const tags = Array.isArray(record.tags) ? record.tags : [];
  const images = Array.isArray(record.imageFiles) ? record.imageFiles.filter(Boolean) : [];
  const descriptionParts = [record.author, record.postTimeText].filter(Boolean);
  const platform = normalizePlatform(record);
  return {
    id: record.postUrl || String(index + 1),
    label: formatLabel(record),
    title: record.theme || '',
    theme: record.theme || '',
    date: record.shootDate || '',
    postDate: record.postDate || '',
    author: record.author || '',
    platform,
    platformLabel: platform === 'xiaohongshu' ? '小红书' : '微博',
    sourceType: record.sourceType || '',
    people,
    postUrl: record.postUrl || '',
    webUrl: record.webUrl || record.pcUrl || '',
    description: descriptionParts.join(' / '),
    text: record.text || '',
    images,
    tags,
    status: record.maintenanceStatus || 'todo',
    note: record.maintenanceNote || '',
    layout: 'gallery'
  };
}

function postSortValue(record) {
  const time = String(record.postTimeText || '').match(/\d{1,2}:\d{2}/)?.[0] || '00:00';
  return `${record.postDate || ''} ${time}`;
}

function compareByPostTimeDesc(a, b) {
  return postSortValue(b).localeCompare(postSortValue(a));
}

function loadMetadata(metadataPath = METADATA_PATH) {
  return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
}

function buildData(metadata = loadMetadata(), dataPath = DATA_PATH, options = {}) {
  const dataVar = options.dataVar || 'galleryData';
  const facetsVar = options.facetsVar || 'galleryFacets';
  const galleryData = [...metadata].sort(compareByPostTimeDesc).map(toGalleryRecord);
  const galleryFacets = {
    authors: uniqueSorted(galleryData.map((item) => item.author)),
    platforms: uniqueSorted(galleryData.map((item) => item.platform)),
    themes: uniqueSorted(galleryData.map((item) => item.theme)),
    tags: uniqueSorted(galleryData.flatMap((item) => item.tags || []))
  };
  const source = [
    '// ==================== GALLERY9704 Data ====================',
    '// Generated from local metadata.json. Do not edit manually.',
    '',
    `const ${dataVar} = ${JSON.stringify(galleryData, null, 2)};`,
    '',
    `const ${facetsVar} = ${JSON.stringify(galleryFacets, null, 2)};`,
    ''
  ].join('\n');
  fs.writeFileSync(dataPath, source);
  return { recordCount: galleryData.length, imageCount: galleryData.reduce((sum, item) => sum + item.images.length, 0) };
}

if (require.main === module) {
  const metadataPath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : METADATA_PATH;
  const dataPath = process.argv[3] ? path.resolve(process.cwd(), process.argv[3]) : DATA_PATH;
  const dataVarIndex = process.argv.indexOf('--data-var');
  const facetsVarIndex = process.argv.indexOf('--facets-var');
  const result = buildData(loadMetadata(metadataPath), dataPath, {
    dataVar: dataVarIndex >= 0 ? process.argv[dataVarIndex + 1] : 'galleryData',
    facetsVar: facetsVarIndex >= 0 ? process.argv[facetsVarIndex + 1] : 'galleryFacets'
  });
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { ROOT, METADATA_PATH, DATA_PATH, buildData, loadMetadata };
