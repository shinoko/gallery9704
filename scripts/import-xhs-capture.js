const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OFFICIAL_METADATA_PATH = path.join(ROOT, 'official-metadata.json');
const DEFAULT_CAPTURE_PATH = path.join(ROOT, 'docs', 'records', 'xhs-capture-all-notes-20260804-2345', 'metadata.json');
const IMAGE_ROOT = path.join(ROOT, 'official-images', 'xhs');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function toRel(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function copyImages(accountKey, note) {
  const noteDir = path.join(IMAGE_ROOT, accountKey, note.noteId);
  ensureDir(noteDir);
  return note.images.map((image) => {
    const source = image.thumbnailFile;
    if (!source || !fs.existsSync(source)) {
      throw new Error(`Missing image for ${note.noteId} #${image.imageIndex}: ${source}`);
    }
    const ext = path.extname(source) || '.jpg';
    const target = path.join(noteDir, `${String(image.imageIndex).padStart(2, '0')}${ext}`);
    fs.copyFileSync(source, target);
    return toRel(target);
  });
}

function targetPeopleFor(accountKey) {
  if (accountKey === 'liu-xuancheng') return ['刘轩丞'];
  return ['展轩'];
}

function sourceTypeFor(accountKey) {
  if (accountKey.endsWith('studio')) return 'xhs-studio';
  return 'xhs-person';
}

function cleanXhsText(note) {
  const text = String(note.text || note.title || '').trim();
  return text
    .split(/\s*猜你想搜\s*/)[0]
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function toOfficialRecord(account, note) {
  const imageFiles = copyImages(account.key, note);
  const author = account.key === 'liu-xuancheng' ? '刘轩丞' : account.name;
  const postUrl = note.noteUrl || `https://www.xiaohongshu.com/explore/${note.noteId}`;
  return {
    id: postUrl,
    platform: 'xiaohongshu',
    sourceType: sourceTypeFor(account.key),
    author,
    authorUrl: account.profileUrl || '',
    postUrl,
    postDate: note.publishDateNormalized || '',
    postTimeText: note.publishTextRaw || note.publishTimeText || '',
    publishTextRaw: note.publishTextRaw || '',
    publishTimeText: note.publishTimeText || '',
    publishDatePrecision: note.publishDatePrecision || '',
    ipLocation: note.ipLocation || '',
    text: cleanXhsText(note),
    tags: Array.isArray(note.tags) ? note.tags : [],
    imageFiles,
    rawPicNum: imageFiles.length,
    targetPeople: targetPeopleFor(account.key),
    shootDate: '',
    theme: '',
    collectionSource: 'xhs-web-image-note-capture',
    collectionAccountId: account.profileId || '',
    collectionAccountName: account.name,
    noteId: note.noteId,
    xhsImageCount: note.imageCount || imageFiles.length,
    xhsExpectedImageCountText: note.expectedImageCountText || '',
    thumbnailLimitBytes: 100000
  };
}

function isSameXhsRecord(record, incoming) {
  if (record.platform !== 'xiaohongshu') return false;
  return Boolean(
    (record.noteId && incoming.noteId && record.noteId === incoming.noteId) ||
    (record.postUrl && incoming.postUrl && record.postUrl === incoming.postUrl) ||
    (record.id && incoming.id && record.id === incoming.id)
  );
}

function importCapture(capturePath, options = {}) {
  const replaceAllXhs = Boolean(options.replaceAllXhs);
  const cleanupCaptureImages = options.cleanupCaptureImages !== false;
  const capture = readJson(capturePath);
  const official = readJson(OFFICIAL_METADATA_PATH);
  const xhsRecords = capture.accounts.flatMap((accountGroup) => {
    return accountGroup.notes.map((note) => toOfficialRecord(accountGroup.account, note));
  });
  const kept = replaceAllXhs
    ? official.filter((record) => record.platform !== 'xiaohongshu')
    : official.filter((record) => !xhsRecords.some((incoming) => isSameXhsRecord(record, incoming)));
  writeJson(OFFICIAL_METADATA_PATH, [...xhsRecords, ...kept]);

  const captureImageDir = path.join(path.dirname(capturePath), 'images');
  const removedCaptureImages = cleanupCaptureImages && fs.existsSync(captureImageDir);
  if (removedCaptureImages) {
    fs.rmSync(captureImageDir, { recursive: true, force: true });
  }

  return {
    mode: replaceAllXhs ? 'replace-all-xhs' : 'incremental',
    importedRecords: xhsRecords.length,
    importedImages: xhsRecords.reduce((sum, record) => sum + record.imageFiles.length, 0),
    officialRecords: xhsRecords.length + kept.length,
    removedCaptureImages
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const replaceAllXhs = args.includes('--replace-all-xhs');
  const keepCaptureImages = args.includes('--keep-capture-images');
  const captureArg = args.find((arg) => !arg.startsWith('--'));
  const capturePath = captureArg ? path.resolve(process.cwd(), captureArg) : DEFAULT_CAPTURE_PATH;
  const result = importCapture(capturePath, { replaceAllXhs, cleanupCaptureImages: !keepCaptureImages });
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { importCapture };
