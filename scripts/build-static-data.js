const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const METADATA_PATH = path.join(ROOT, 'metadata.json');
const DATA_PATH = path.join(ROOT, 'js', 'data.js');

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
}

function formatLabel(record) {
  return [record.author, record.postDate].filter(Boolean).join(' · ');
}

function toGalleryRecord(record, index) {
  const people = Array.isArray(record.targetPeople) ? record.targetPeople : [];
  const tags = Array.isArray(record.tags) ? record.tags : [];
  const images = Array.isArray(record.imageFiles) ? record.imageFiles : [];
  const descriptionParts = [record.author, record.postTimeText].filter(Boolean);
  return {
    id: record.postUrl || String(index + 1),
    label: formatLabel(record),
    title: record.theme || '未分类主题',
    theme: record.theme || '',
    date: record.shootDate || '',
    postDate: record.postDate || '',
    author: record.author || '',
    people,
    postUrl: record.postUrl || '',
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

function loadMetadata() {
  return JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8'));
}

function buildData(metadata = loadMetadata()) {
  const galleryData = [...metadata].sort(compareByPostTimeDesc).map(toGalleryRecord);
  const galleryFacets = {
    authors: uniqueSorted(galleryData.map((item) => item.author)),
    themes: uniqueSorted(galleryData.map((item) => item.theme)),
    tags: uniqueSorted(galleryData.flatMap((item) => item.tags || []))
  };
  const source = [
    '// ==================== GALLERY9704 Data ====================',
    '// Generated from local metadata.json. Do not edit manually.',
    '',
    `const galleryData = ${JSON.stringify(galleryData, null, 2)};`,
    '',
    `const galleryFacets = ${JSON.stringify(galleryFacets, null, 2)};`,
    ''
  ].join('\n');
  fs.writeFileSync(DATA_PATH, source);
  return { recordCount: galleryData.length, imageCount: galleryData.reduce((sum, item) => sum + item.images.length, 0) };
}

if (require.main === module) {
  const result = buildData();
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { ROOT, METADATA_PATH, DATA_PATH, buildData, loadMetadata };
