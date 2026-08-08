const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DELETED_RECORDS_PATH = path.join(ROOT, 'docs', 'records', 'manual-deleted-records.json');

function loadDeletedRecords(filePath = DELETED_RECORDS_PATH) {
  if (!fs.existsSync(filePath)) return [];
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Array.isArray(parsed) ? parsed : [];
}

function deletedRecordKey(record) {
  return String(record.postUrl || record.noteId || '').trim();
}

function deletedPostUrlSet(dataType = '', filePath = DELETED_RECORDS_PATH) {
  return new Set(
    loadDeletedRecords(filePath)
      .filter((record) => !dataType || !record.dataType || record.dataType === dataType)
      .map(deletedRecordKey)
      .filter(Boolean)
  );
}

function toDeletedRecord(record, dataType, deletedAt = new Date().toISOString()) {
  return {
    dataType,
    sourceType: record.sourceType || '',
    postUrl: record.postUrl || '',
    noteId: record.noteId || '',
    author: record.author || '',
    authorUrl: record.authorUrl || '',
    collectionAccountUid: record.collectionAccountUid || '',
    collectionAccountName: record.collectionAccountName || '',
    postDate: record.postDate || '',
    postTimeText: record.postTimeText || '',
    bid: record.bid || '',
    mid: record.mid || record.mblogId || '',
    reason: 'manual-delete',
    deletedAt
  };
}

function appendDeletedRecords(records, dataType, filePath = DELETED_RECORDS_PATH) {
  const incoming = (records || [])
    .map((record) => toDeletedRecord(record, dataType))
    .filter((record) => deletedRecordKey(record));
  if (!incoming.length) return { filePath, added: 0, total: loadDeletedRecords(filePath).length };

  const existing = loadDeletedRecords(filePath);
  const byKey = new Map(existing.map((record) => [deletedRecordKey(record), record]));
  let added = 0;
  for (const record of incoming) {
    const key = deletedRecordKey(record);
    if (byKey.has(key)) continue;
    byKey.set(key, record);
    added += 1;
  }

  const merged = Array.from(byKey.values()).sort((a, b) => {
    const date = String(b.deletedAt || '').localeCompare(String(a.deletedAt || ''));
    if (date) return date;
    return deletedRecordKey(a).localeCompare(deletedRecordKey(b));
  });

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(merged, null, 2)}\n`);
  return { filePath, added, total: merged.length };
}

module.exports = {
  DELETED_RECORDS_PATH,
  appendDeletedRecords,
  deletedPostUrlSet,
  loadDeletedRecords
};
