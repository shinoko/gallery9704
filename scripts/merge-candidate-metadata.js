const fs = require('fs');
const path = require('path');
const { buildData, METADATA_PATH } = require('./build-static-data');
const { applyMetadataRules, isBlacklisted } = require('./clean-metadata');

const inputPath = process.argv[2];

if (!inputPath) {
  console.error('Usage: node scripts/merge-candidate-metadata.js <candidate-json>');
  process.exit(1);
}

const absoluteInputPath = path.resolve(process.cwd(), inputPath);
const candidate = JSON.parse(fs.readFileSync(absoluteInputPath, 'utf8'));
const metadata = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8'));
const existingUrls = new Set(metadata.map((record) => record.postUrl).filter(Boolean));

const incoming = (candidate.records || [])
  .filter((record) => record.postUrl && !existingUrls.has(record.postUrl))
  .filter((record) => !isBlacklisted(record))
  .map(applyMetadataRules);

const merged = [...metadata, ...incoming];
fs.writeFileSync(METADATA_PATH, `${JSON.stringify(merged, null, 2)}\n`);
const buildResult = buildData(merged);

console.log(JSON.stringify({
  beforeRecords: metadata.length,
  incomingRecords: incoming.length,
  afterRecords: merged.length,
  skippedExisting: (candidate.records || []).filter((record) => existingUrls.has(record.postUrl)).length,
  buildResult
}, null, 2));
