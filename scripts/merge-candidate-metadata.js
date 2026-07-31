const fs = require('fs');
const path = require('path');
const { buildData, METADATA_PATH, DATA_PATH, loadMetadata } = require('./build-static-data');
const { applyMetadataRules, isBlacklisted } = require('./clean-metadata');

const inputPath = process.argv[2];
const metadataArgIndex = process.argv.indexOf('--metadata');
const dataArgIndex = process.argv.indexOf('--data');
const dataVarArgIndex = process.argv.indexOf('--data-var');
const facetsVarArgIndex = process.argv.indexOf('--facets-var');
const metadataPath = metadataArgIndex >= 0 ? path.resolve(process.cwd(), process.argv[metadataArgIndex + 1]) : METADATA_PATH;
const dataPath = dataArgIndex >= 0 ? path.resolve(process.cwd(), process.argv[dataArgIndex + 1]) : DATA_PATH;
const dataVar = dataVarArgIndex >= 0 ? process.argv[dataVarArgIndex + 1] : 'galleryData';
const facetsVar = facetsVarArgIndex >= 0 ? process.argv[facetsVarArgIndex + 1] : 'galleryFacets';

if (!inputPath) {
  console.error('Usage: node scripts/merge-candidate-metadata.js <candidate-json> [--metadata metadata.json] [--data js/data.js] [--data-var galleryData] [--facets-var galleryFacets]');
  process.exit(1);
}

const absoluteInputPath = path.resolve(process.cwd(), inputPath);
const candidate = JSON.parse(fs.readFileSync(absoluteInputPath, 'utf8'));
const metadata = fs.existsSync(metadataPath) ? loadMetadata(metadataPath) : [];
const existingUrls = new Set(metadata.map((record) => record.postUrl).filter(Boolean));

function cleanTag(tag) {
  return String(tag || '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200f\ufeff]/g, '')
    .trim();
}

function extractTags(text) {
  const tags = [];
  for (const match of String(text || '').matchAll(/#([^#\n]{1,80})#/g)) {
    const tag = cleanTag(match[1]);
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

function extractTargetPeople(text) {
  const source = String(text || '');
  return [
    source.includes('展轩') ? '展轩' : '',
    source.includes('刘轩丞') ? '刘轩丞' : ''
  ].filter(Boolean);
}

function applyCollectionFields(record) {
  return {
    ...record,
    tags: extractTags(record.text),
    targetPeople: extractTargetPeople(record.text)
  };
}

const incoming = (candidate.records || [])
  .filter((record) => record.postUrl && !existingUrls.has(record.postUrl))
  .filter((record) => !isBlacklisted(record))
  .map(applyCollectionFields)
  .map(applyMetadataRules);

const merged = [...metadata, ...incoming];
fs.writeFileSync(metadataPath, `${JSON.stringify(merged, null, 2)}\n`);
const buildResult = buildData(merged, dataPath, { dataVar, facetsVar });

console.log(JSON.stringify({
  metadataPath,
  dataPath,
  dataVar,
  facetsVar,
  beforeRecords: metadata.length,
  incomingRecords: incoming.length,
  afterRecords: merged.length,
  skippedExisting: (candidate.records || []).filter((record) => existingUrls.has(record.postUrl)).length,
  buildResult
}, null, 2));
