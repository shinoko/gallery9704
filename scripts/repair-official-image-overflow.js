const fs = require('fs');
const path = require('path');
const { buildData } = require('./build-static-data');

const ROOT = path.resolve(__dirname, '..');
const candidatePath = path.resolve(process.cwd(), process.argv[2]);
const metadataPath = path.join(ROOT, 'official-metadata.json');
const dataPath = path.join(ROOT, 'js', 'official-data.js');

if (!candidatePath || !fs.existsSync(candidatePath)) {
  console.error('Usage: node scripts/repair-official-image-overflow.js <candidate-json>');
  process.exit(1);
}

const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const updates = new Map((candidate.records || []).map((record) => [record.postUrl, record]));
let updated = 0;

const merged = metadata.map((record) => {
  const replacement = updates.get(record.postUrl);
  if (!replacement) return record;
  updated += 1;
  return {
    ...record,
    imageCount: replacement.imageCount,
    imageUrls: replacement.imageUrls,
    imageFiles: replacement.imageFiles
  };
});

fs.writeFileSync(metadataPath, `${JSON.stringify(merged, null, 2)}\n`);
const buildResult = buildData(merged, dataPath, {
  dataVar: 'officialGalleryData',
  facetsVar: 'officialGalleryFacets'
});

console.log(JSON.stringify({
  metadataPath,
  dataPath,
  candidateRecords: updates.size,
  updated,
  buildResult
}, null, 2));
