const fs = require('fs');
const https = require('https');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RECORDS_DIR = path.join(ROOT, 'docs', 'records');
const inputPath = process.argv[2] || path.join(RECORDS_DIR, 'themidnighthush-collection-candidate.json');
const outputPath = process.argv[3] || path.join(RECORDS_DIR, 'themidnighthush-image-download-report.json');
const force = process.argv.includes('--force');

function toThumbnailUrl(url) {
  return String(url || '')
    .replace('/large/', '/orj360/')
    .replace('/mw2000/', '/orj360/')
    .replace('/orj960/', '/orj360/')
    .replace('/orj480/', '/orj360/');
}

function download(url, dest) {
  return new Promise((resolve) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const file = fs.createWriteStream(dest);
    const request = https.get(url, {
      headers: {
        Referer: 'https://weibo.com/',
        'User-Agent': 'Mozilla/5.0'
      }
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.rmSync(dest, { force: true });
        download(new URL(response.headers.location, url).href, dest).then(resolve);
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.rmSync(dest, { force: true });
        resolve({ ok: false, statusCode: response.statusCode, url, dest });
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve({ ok: true, statusCode: response.statusCode, url, dest, bytes: fs.statSync(dest).size });
      });
    });

    request.on('error', (error) => {
      file.close();
      fs.rmSync(dest, { force: true });
      resolve({ ok: false, error: error.message, url, dest });
    });
    request.setTimeout(30000, () => request.destroy(new Error('timeout')));
  });
}

async function main() {
  const candidate = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const results = [];
  for (const record of candidate.records || []) {
    for (let index = 0; index < (record.imageUrls || []).length; index += 1) {
      const dest = path.join(ROOT, record.imageFiles[index]);
      const url = toThumbnailUrl(record.imageUrls[index]);
      if (fs.existsSync(dest) && !force) {
        results.push({ ok: true, skipped: true, dest, bytes: fs.statSync(dest).size });
        continue;
      }
      results.push(await download(url, dest));
    }
  }
  fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify({
    total: results.length,
    ok: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok)
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
