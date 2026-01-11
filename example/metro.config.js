const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Configure polyfills for Starknet.js
config.resolver.unstable_conditionNames = [
  'browser',
  'require',
  'react-native',
];

const projectRoot = __dirname;
const libraryRoot = path.resolve(projectRoot, '..');

// Watch the parent directory (for src files)
config.watchFolders = [libraryRoot];

// Block root node_modules to prevent duplicate React
config.resolver.blockList = [
  new RegExp(`${libraryRoot.replace(/\//g, '\\/')}/node_modules/.*`),
];

// Only use example's node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

// Map package name and force all shared dependencies to resolve from example
config.resolver.extraNodeModules = {
  // Polyfills
  crypto: require.resolve('expo-crypto'),
  stream: require.resolve('readable-stream'),
  // Map library package name to src
  '@keep-starknet-strange/privy-starknet-provider': path.resolve(libraryRoot, 'src'),
  // Force all shared dependencies to use example's node_modules
  'react': path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
  'starknet': path.resolve(projectRoot, 'node_modules/starknet'),
  '@avnu/gasless-sdk': path.resolve(projectRoot, 'node_modules/@avnu/gasless-sdk'),
  '@privy-io/expo': path.resolve(projectRoot, 'node_modules/@privy-io/expo'),
};

module.exports = config;
