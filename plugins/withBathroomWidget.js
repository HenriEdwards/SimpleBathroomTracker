const { AndroidConfig, withAndroidManifest, withDangerousMod, withMainApplication } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const WIDGET_ROOT = 'android-widget';

function getPackageName(config) {
  return config.android?.package ?? AndroidConfig.Package.getPackageName(config);
}

function ensureDirSync(target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
}

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) {
    return;
  }
  ensureDirSync(dest);
  fs.readdirSync(src, { withFileTypes: true }).forEach((entry) => {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
      return;
    }
    fs.copyFileSync(srcPath, destPath);
  });
}

function rewriteWidgetSource(contents, packageName) {
  let updated = contents.replace(/^package\s+[\w.]+\.widget/m, `package ${packageName}.widget`);
  updated = updated.replace(
    /^import\s+[\w.]+\.MainActivity\s*$/gm,
    `import ${packageName}.MainActivity`
  );
  updated = updated.replace(/^import\s+[\w.]+\.R\s*$/gm, `import ${packageName}.R`);
  updated = updated.replace(/\"[\w.]+\.widget\.ACTION_/g, `"${packageName}.widget.ACTION_`);
  updated = updated.replace(/com\.anonymous\.bathroomcounter/g, packageName);
  return updated;
}

function copyWidgetSources(projectRoot, androidProjectRoot, packageName) {
  const srcDir = path.join(projectRoot, WIDGET_ROOT, 'java');
  if (!fs.existsSync(srcDir)) {
    return;
  }
  const packagePath = packageName.split('.').join(path.sep);
  const destDir = path.join(androidProjectRoot, 'app', 'src', 'main', 'java', packagePath, 'widget');
  ensureDirSync(destDir);
  fs.readdirSync(srcDir).forEach((file) => {
    if (!file.endsWith('.kt') && !file.endsWith('.java')) {
      return;
    }
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);
    const contents = fs.readFileSync(srcPath, 'utf8');
    const updated = rewriteWidgetSource(contents, packageName);
    fs.writeFileSync(destPath, updated);
  });
}

function copyWidgetResources(projectRoot, androidProjectRoot) {
  const resDir = path.join(projectRoot, WIDGET_ROOT, 'res');
  const destRes = path.join(androidProjectRoot, 'app', 'src', 'main', 'res');
  copyDirSync(resDir, destRes);
}

function updateProguard(androidProjectRoot, packageName) {
  const proguardPath = path.join(androidProjectRoot, 'app', 'proguard-rules.pro');
  if (!fs.existsSync(proguardPath)) {
    return;
  }
  const keepProvider = `-keep class ${packageName}.widget.BathroomWidgetProvider { *; }`;
  const keepAll = `-keep class ${packageName}.widget.** { *; }`;
  let contents = fs.readFileSync(proguardPath, 'utf8');
  contents = contents.replace(
    /-keep class [\\w.]+\\.widget\\.BathroomWidgetProvider \\{ \\*; \\}/g,
    keepProvider
  );
  contents = contents.replace(/-keep class [\\w.]+\\.widget\\.\\*\\* \\{ \\*; \\}/g, keepAll);
  if (!contents.includes(keepProvider)) {
    contents = `${contents.trimEnd()}\n${keepProvider}\n`;
  }
  if (!contents.includes(keepAll)) {
    contents = `${contents.trimEnd()}\n${keepAll}\n`;
  }
  fs.writeFileSync(proguardPath, contents);
}

function ensureWidgetReceiver(androidManifest, packageName) {
  const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  mainApplication.receiver = mainApplication.receiver ?? [];
  mainApplication.receiver = mainApplication.receiver.filter((receiver) => {
    const name = receiver?.$?.['android:name'];
    return !name?.endsWith('.BathroomWidgetProvider');
  });

  mainApplication.receiver.push({
    $: {
      'android:name': `${packageName}.widget.BathroomWidgetProvider`,
      'android:exported': 'true',
      'android:permission': 'android.permission.BIND_APPWIDGET',
      'tools:replace': 'android:name,android:exported,android:permission',
    },
    'intent-filter': [
      {
        action: [
          {
            $: {
              'android:name': 'android.appwidget.action.APPWIDGET_UPDATE',
            },
          },
        ],
      },
    ],
    'meta-data': [
      {
        $: {
          'android:name': 'android.appwidget.provider',
          'android:resource': '@xml/bathroom_widget_info',
        },
      },
    ],
  });
  return androidManifest;
}

function ensureWidgetPackage(contents, packageName) {
  const importLine = `import ${packageName}.widget.WidgetBridgePackage`;
  let updated = contents;

  if (!updated.includes(importLine)) {
    updated = updated.replace(/^package .*\n/, (match) => `${match}${importLine}\n`);
  }

  if (!updated.includes('add(WidgetBridgePackage())')) {
    const marker =
      '// Packages that cannot be autolinked yet can be added manually here, for example:';
    if (updated.includes(marker)) {
      updated = updated.replace(marker, `${marker}\n          add(WidgetBridgePackage())`);
    } else {
      updated = updated.replace(
        'PackageList(this).packages.apply {',
        'PackageList(this).packages.apply {\n          add(WidgetBridgePackage())'
      );
    }
  }

  return updated;
}

module.exports = function withBathroomWidget(config) {
  config = withAndroidManifest(config, (config) => {
    const packageName = getPackageName(config);
    if (!packageName) {
      throw new Error('android.package is required to configure the widget.');
    }
    if (!config.modResults.manifest.$['xmlns:tools']) {
      config.modResults.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }
    config.modResults = ensureWidgetReceiver(config.modResults, packageName);
    return config;
  });

  config = withMainApplication(config, (config) => {
    const packageName = getPackageName(config);
    if (!packageName) {
      throw new Error('android.package is required to configure the widget.');
    }
    config.modResults.contents = ensureWidgetPackage(config.modResults.contents, packageName);
    return config;
  });

  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const packageName = getPackageName(config);
      if (!packageName) {
        throw new Error('android.package is required to configure the widget.');
      }
      const projectRoot = config.modRequest.projectRoot;
      const androidProjectRoot = config.modRequest.platformProjectRoot;
      copyWidgetResources(projectRoot, androidProjectRoot);
      copyWidgetSources(projectRoot, androidProjectRoot, packageName);
      updateProguard(androidProjectRoot, packageName);
      return config;
    },
  ]);

  return config;
};
