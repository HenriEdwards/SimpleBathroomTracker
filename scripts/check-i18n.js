const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'src', 'i18n', 'translations');
const languages = ['en', 'es', 'pt', 'fr', 'hi', 'id', 'de', 'ja'];

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function flatten(obj, prefix = '') {
  return Object.keys(obj).flatMap((key) => {
    const value = obj[key];
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return flatten(value, nextKey);
    }
    return nextKey;
  });
}

function checkParity() {
  const basePath = path.join(baseDir, 'en.json');
  const base = loadJson(basePath);
  const baseKeys = new Set(flatten(base));

  let ok = true;
  languages.forEach((language) => {
    if (language === 'en') {
      return;
    }
    const filePath = path.join(baseDir, `${language}.json`);
    const data = loadJson(filePath);
    const keys = new Set(flatten(data));
    const missing = Array.from(baseKeys).filter((key) => !keys.has(key));
    const extra = Array.from(keys).filter((key) => !baseKeys.has(key));
    if (missing.length || extra.length) {
      ok = false;
      console.log(`\n${language}:`);
      if (missing.length) {
        console.log(`  Missing keys (${missing.length}):`);
        missing.forEach((key) => console.log(`    - ${key}`));
      }
      if (extra.length) {
        console.log(`  Extra keys (${extra.length}):`);
        extra.forEach((key) => console.log(`    - ${key}`));
      }
    }
  });

  if (!ok) {
    process.exit(1);
  }
  console.log('i18n check passed: all translation files match en.json');
}

checkParity();
