const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'preview-assets');
const nodeModules = '/Users/orisun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function waitForGallery(page) {
  await page.waitForSelector('#seriesList .series-card, #seriesList .series-item', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(900);
}

async function revealFooter(page) {
  for (let i = 0; i < 80; i++) {
    const visible = await page.locator('footer.footer').evaluate((footer) => {
      const rect = footer.getBoundingClientRect();
      return rect.top < window.innerHeight - 120 && rect.bottom > 0;
    }).catch(() => false);
    if (visible) {
      await page.locator('footer.footer').scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, 140));
      return;
    }
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(350);
  }
}

async function prepareState(page, stateName) {
  const dataType = process.env.PREVIEW_DATA_TYPE || (stateName === 'station' ? 'station' : '');
  const theme = process.env.PREVIEW_THEME || '';
  const authorQuery = (process.env.PREVIEW_AUTHOR_QUERY || '').toLowerCase();

  if (dataType === 'station') {
    await page.click('#stationTab');
    await waitForGallery(page);
  }

  if (theme || authorQuery) {
    await page.evaluate(({ theme, authorQuery }) => {
      const themeFilter = document.querySelector('#themeFilter');
      const authorFilter = document.querySelector('#authorFilter');

      if (themeFilter && theme) {
        const themeOption = Array.from(themeFilter.options).find((option) => option.value === theme || option.textContent === theme);
        if (themeOption) themeFilter.value = themeOption.value;
      }

      if (authorFilter && authorQuery) {
        const authorOption = Array.from(authorFilter.options).find((option) => {
          const value = `${option.value} ${option.textContent}`.toLowerCase();
          return value.includes(authorQuery);
        });
        if (authorOption) authorFilter.value = authorOption.value;
      }
    }, { theme, authorQuery });
    await page.evaluate(() => document.querySelector('#applyFilters')?.click());
    await waitForGallery(page);
  }

  if (stateName === 'filter') {
    await page.click('#navToggle');
    await page.waitForSelector('#sidebar:not(.hidden)', { timeout: 5000 });
    await page.waitForTimeout(500);
  }

  if (stateName === 'footer') {
    await revealFooter(page);
    await page.waitForTimeout(600);
  }
}

async function capturePage(page, url, viewport, outPath, stateName = 'default') {
  await page.setViewportSize(viewport);
  await page.goto(url, { waitUntil: 'networkidle' });
  await waitForGallery(page);
  await prepareState(page, stateName);
  if (stateName.startsWith('footer')) {
    const fullPath = outPath.replace(/\.png$/, '-full.png');
    await page.screenshot({ path: fullPath, fullPage: true });
    const meta = await sharp(fullPath).metadata();
    const extractHeight = Math.min(viewport.height, meta.height || viewport.height);
    await sharp(fullPath)
      .extract({
        left: 0,
        top: Math.max(0, (meta.height || viewport.height) - extractHeight),
        width: Math.min(viewport.width, meta.width || viewport.width),
        height: extractHeight,
      })
      .toFile(outPath);
    await fs.promises.unlink(fullPath).catch(() => {});
    return;
  }
  await page.screenshot({ path: outPath, fullPage: false });
}

async function launchChromium() {
  const options = fs.existsSync(chromePath) ? { headless: true, executablePath: chromePath } : { headless: true };
  return chromium.launch(options);
}

function previewHtml({ mode, screenshot, background }) {
  const isMobile = mode === 'mobile';
  const frameClass = isMobile ? 'phone-frame' : 'browser-frame';
  const title = isMobile ? 'gallery9704 · mobile' : 'gallery9704.pages.dev';
  const imgMaxWidth = isMobile ? (process.env.PREVIEW_MOBILE_WIDTH || '620px') : '1296px';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; }
    body {
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: url("${background}") center / cover no-repeat;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      overflow: hidden;
    }
    .stage {
      width: 100vw;
      height: 100vh;
      display: grid;
      place-items: center;
      padding: ${isMobile ? '56px 72px' : '112px 96px'};
    }
    .browser-frame,
    .phone-frame {
      position: relative;
      overflow: hidden;
      background: #fffdfa;
      box-shadow: 0 28px 58px rgba(87, 71, 78, 0.22), 0 8px 22px rgba(87, 71, 78, 0.12);
    }
    .browser-frame {
      width: min(${imgMaxWidth}, calc(100vw - 144px));
      border-radius: 28px;
      border: 1px solid rgba(255, 255, 255, 0.72);
      padding-top: 56px;
    }
    .browser-bar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 56px;
      display: grid;
      grid-template-columns: 128px 1fr 128px;
      align-items: center;
      padding: 0 22px;
      background: rgba(255, 253, 250, 0.92);
      border-bottom: 1px solid rgba(45, 45, 45, 0.08);
      color: rgba(45, 45, 45, 0.52);
      font-size: 14px;
    }
    .dots { display: flex; gap: 8px; }
    .dots span {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: #f2d4dd;
    }
    .dots span:nth-child(2) { background: #f5e7bf; }
    .dots span:nth-child(3) { background: #cfe6d0; }
    .address {
      justify-self: center;
      width: min(520px, 100%);
      height: 24px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      background: #f7f4ef;
    }
    .actions {
      justify-self: end;
      display: flex;
      gap: 14px;
      font-size: 20px;
      line-height: 1;
    }
    .browser-frame img {
      display: block;
      width: 100%;
      height: auto;
    }
    .phone-frame {
      width: min(${imgMaxWidth}, calc(100vw - 120px));
      border-radius: 42px;
      border: 12px solid #fffdfa;
      padding-top: 18px;
    }
    .phone-frame::before {
      content: "";
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      width: 88px;
      height: 7px;
      border-radius: 999px;
      background: rgba(45, 45, 45, 0.14);
      z-index: 2;
    }
    .phone-frame img {
      display: block;
      width: 100%;
      height: auto;
      border-radius: 28px;
    }
    .actions span {
      display: block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(45, 45, 45, 0.36);
      border-radius: 4px;
    }
    .actions span:first-child {
      border-radius: 999px;
    }
    .actions span:nth-child(2) {
      position: relative;
      border: 0;
    }
    .actions span:nth-child(2)::before,
    .actions span:nth-child(2)::after {
      content: "";
      position: absolute;
      left: 50%;
      top: 50%;
      width: 16px;
      height: 2px;
      background: rgba(45, 45, 45, 0.36);
      transform: translate(-50%, -50%);
    }
    .actions span:nth-child(2)::after {
      width: 2px;
      height: 16px;
    }
  </style>
</head>
<body>
  <main class="stage">
    <section class="${frameClass}">
      ${isMobile ? '' : `<div class="browser-bar"><div class="dots"><span></span><span></span><span></span></div><div class="address">${title}</div><div class="actions"><span></span><span></span><span></span></div></div>`}
      <img src="${screenshot}" alt="">
    </section>
  </main>
</body>
</html>`;
}

async function main() {
  await ensureDir(outDir);

  const url = process.env.PREVIEW_URL || 'http://127.0.0.1:4182/';
  const suffix = process.env.PREVIEW_SUFFIX ? `-${process.env.PREVIEW_SUFFIX}` : '';
  const stateName = process.env.PREVIEW_STATE || 'default';
  const stateSuffix = stateName === 'default' ? suffix : `${suffix}-${stateName}`;
  const desktopRaw = path.join(outDir, `gallery9704-desktop-screenshot${stateSuffix}.png`);
  const mobileRaw = path.join(outDir, `gallery9704-mobile-screenshot${stateSuffix}.png`);
  const desktopHtml = path.join(outDir, `desktop-preview${stateSuffix}.html`);
  const mobileHtml = path.join(outDir, `mobile-preview${stateSuffix}.html`);
  const desktopPreview = path.join(outDir, `gallery9704-desktop-preview${stateSuffix}.png`);
  const mobilePreview = path.join(outDir, `gallery9704-mobile-preview${stateSuffix}.png`);
  const background = process.env.PREVIEW_BACKGROUND
    ? path.resolve(root, process.env.PREVIEW_BACKGROUND)
    : path.join(outDir, 'gallery9704-preview-bg.png');

  const browser = await launchChromium();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await capturePage(page, url, { width: 1440, height: 980 }, desktopRaw, stateName);
  await capturePage(page, url, { width: 390, height: 844 }, mobileRaw, stateName);
  await browser.close();

  const rel = (file) => './' + path.basename(file);
  await fs.promises.writeFile(
    desktopHtml,
    previewHtml({ mode: 'desktop', screenshot: rel(desktopRaw), background: rel(background) })
  );
  await fs.promises.writeFile(
    mobileHtml,
    previewHtml({ mode: 'mobile', screenshot: rel(mobileRaw), background: rel(background) })
  );

  const previewBrowser = await launchChromium();
  const desktopPage = await previewBrowser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  await desktopPage.goto('file://' + desktopHtml, { waitUntil: 'load' });
  await desktopPage.screenshot({ path: desktopPreview, fullPage: false });

  const mobilePage = await previewBrowser.newPage({ viewport: { width: 1200, height: 1600 }, deviceScaleFactor: 1 });
  await mobilePage.goto('file://' + mobileHtml, { waitUntil: 'load' });
  await mobilePage.screenshot({ path: mobilePreview, fullPage: false });
  await previewBrowser.close();

  console.log([
    desktopRaw,
    mobileRaw,
    desktopPreview,
    mobilePreview,
  ].join('\n'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
