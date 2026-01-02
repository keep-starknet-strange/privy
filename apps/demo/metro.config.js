const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable package exports to avoid Node.js module resolution issues
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
