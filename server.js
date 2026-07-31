const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { ROOT, METADATA_PATH, buildData, loadMetadata } = require('./scripts/build-static-data');

const PORT = Number(process.env.PORT || 4182);
const HOST = process.env.HOST || '127.0.0.1';
const MIME = {
  '.html': 'text/html;charset=utf-8',
  '.css': 'text/css;charset=utf-8',
  '.js': 'text/javascript;charset=utf-8',
  '.json': 'application/json;charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

function sendJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json;charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error('请求体过大'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('JSON 格式错误'));
      }
    });
    req.on('error', reject);
  });
}

function resolveInsideRoot(relativePath) {
  const target = path.resolve(ROOT, relativePath);
  if (!target.startsWith(ROOT + path.sep)) throw new Error(`非法路径：${relativePath}`);
  return target;
}

async function writeMetadata(records) {
  await fsp.writeFile(METADATA_PATH, JSON.stringify(records, null, 2));
  return buildData(records);
}

function recordId(record, index) {
  return record.postUrl || String(index + 1);
}

async function deleteRecords(ids) {
  const idSet = new Set((ids || []).map(String));
  if (idSet.size === 0) return { deletedRecords: 0, deletedImages: 0, missingImages: 0 };

  const metadata = loadMetadata();
  const kept = [];
  const removed = [];
  metadata.forEach((record, index) => {
    if (idSet.has(recordId(record, index))) removed.push(record);
    else kept.push(record);
  });

  let deletedImages = 0;
  let missingImages = 0;
  for (const record of removed) {
    for (const imageFile of record.imageFiles || []) {
      const imagePath = resolveInsideRoot(imageFile);
      try {
        await fsp.rm(imagePath, { force: true });
        deletedImages += 1;
      } catch (error) {
        if (error.code === 'ENOENT') missingImages += 1;
        else throw error;
      }
    }
  }

  const dataResult = await writeMetadata(kept);
  return { deletedRecords: removed.length, deletedImages, missingImages, ...dataResult };
}

async function updateRecord(id, patch) {
  const metadata = loadMetadata();
  const index = metadata.findIndex((record, itemIndex) => recordId(record, itemIndex) === String(id));
  if (index === -1) {
    const error = new Error('未找到对应微博数据');
    error.status = 404;
    throw error;
  }

  const current = metadata[index];
  metadata[index] = {
    ...current,
    theme: String(patch.theme ?? current.theme ?? '').trim(),
    shootDate: String(patch.date ?? current.shootDate ?? '').trim(),
    tags: Array.isArray(patch.tags) ? patch.tags.map(String).map((item) => item.trim()).filter(Boolean) : (current.tags || []),
    maintenanceStatus: String(patch.status ?? current.maintenanceStatus ?? 'todo'),
    maintenanceNote: String(patch.note ?? current.maintenanceNote ?? '').trim(),
    maintenanceUpdatedAt: new Date().toISOString()
  };
  const dataResult = await writeMetadata(metadata);
  return { record: metadata[index], ...dataResult };
}

async function copyFileEnsured(from, to) {
  await fsp.mkdir(path.dirname(to), { recursive: true });
  await fsp.copyFile(from, to);
}

function formatExportStamp(date = new Date()) {
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0')
  ];
  return parts.join('');
}

async function exportStatic() {
  buildData();
  const stamp = formatExportStamp();
  const exportRoot = path.join(ROOT, 'exports', `gallery9704_${stamp}`);
  await fsp.mkdir(exportRoot, { recursive: true });
  await copyFileEnsured(path.join(ROOT, 'index.html'), path.join(exportRoot, 'index.html'));
  await copyFileEnsured(path.join(ROOT, 'css', 'style.css'), path.join(exportRoot, 'css', 'style.css'));
  await copyFileEnsured(path.join(ROOT, 'js', 'data.js'), path.join(exportRoot, 'js', 'data.js'));
  let mainSource = await fsp.readFile(path.join(ROOT, 'js', 'main.js'), 'utf8');
  mainSource = `window.GALLERY9704_STATIC_EXPORT = true;\n${mainSource}`;
  await fsp.mkdir(path.join(exportRoot, 'js'), { recursive: true });
  await fsp.writeFile(path.join(exportRoot, 'js', 'main.js'), mainSource);

  const metadata = loadMetadata();
  const imageFiles = Array.from(new Set(metadata.flatMap((record) => record.imageFiles || [])));
  let copiedImages = 0;
  for (const imageFile of imageFiles) {
    const source = resolveInsideRoot(imageFile);
    const target = path.join(exportRoot, imageFile);
    try {
      await copyFileEnsured(source, target);
      copiedImages += 1;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return { exportPath: exportRoot, records: metadata.length, copiedImages };
}

async function handleApi(req, res, pathname) {
  try {
    if (req.method === 'POST' && pathname === '/api/delete-records') {
      const payload = await readBody(req);
      return sendJson(res, 200, await deleteRecords(payload.ids));
    }
    if (req.method === 'POST' && pathname === '/api/records/update') {
      const payload = await readBody(req);
      return sendJson(res, 200, await updateRecord(payload.id, payload.patch || {}));
    }
    if (req.method === 'POST' && pathname === '/api/export-static') {
      return sendJson(res, 200, await exportStatic());
    }
    sendJson(res, 404, { error: 'API 不存在' });
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message || '服务端错误' });
  }
}

function serveStatic(req, res, pathname) {
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  let filePath;
  try {
    filePath = resolveInsideRoot(relativePath);
  } catch {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url.pathname);
    return;
  }
  serveStatic(req, res, decodeURIComponent(url.pathname));
});

if (process.argv.includes('--export-static')) {
  exportStatic()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
} else {
  server.listen(PORT, HOST, () => {
    console.log(`GALLERY9704 running at http://${HOST}:${PORT}/`);
  });
}
