const fs = require('fs');
const path = require('path');
const { ROOT, getClientConfig } = require('./config');

function buildAppConfig(outputPath = path.join(ROOT, 'js', 'config.js')) {
  const source = [
    '// ==================== GALLERY9704 Config ====================',
    '// Generated from config/*.json. Do not edit manually.',
    '',
    `window.GALLERY9704_CONFIG = ${JSON.stringify(getClientConfig(), null, 2)};`,
    ''
  ].join('\n');
  fs.writeFileSync(outputPath, source);
  return { outputPath };
}

if (require.main === module) {
  console.log(JSON.stringify(buildAppConfig(), null, 2));
}

module.exports = { buildAppConfig };
