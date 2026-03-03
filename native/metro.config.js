// metro.config.js — Expo 55 monorepo config
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the shared/ directory for changes
config.watchFolders = [path.resolve(monorepoRoot, 'shared')];

// Resolve node_modules only from native/
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

module.exports = config;
