const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_DIR = path.join(ROOT, 'config');

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, name), 'utf8'));
}

function loadAppConfig() {
  return {
    themes: readJson('themes.json'),
    platforms: readJson('platforms.json'),
    accounts: readJson('accounts.json')
  };
}

function getPlatformMap(config = loadAppConfig()) {
  return new Map(config.platforms.map((platform) => [platform.id, platform]));
}

function getThemeSortMeta(config = loadAppConfig()) {
  return new Map((config.themes.themes || []).map((theme, index) => [
    theme.name,
    {
      date: theme.date || theme.from || '',
      index: Number.isFinite(theme.order) ? theme.order : index
    }
  ]));
}

function getClientConfig(config = loadAppConfig()) {
  return {
    themes: config.themes.themes || [],
    platforms: config.platforms || [],
    authorAliases: config.accounts.displayAliases || {}
  };
}

module.exports = {
  ROOT,
  CONFIG_DIR,
  loadAppConfig,
  getClientConfig,
  getPlatformMap,
  getThemeSortMeta
};
