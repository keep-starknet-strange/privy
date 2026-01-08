const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configure polyfills for Starknet.js (based on click-chain implementation)
config.resolver.unstable_conditionNames = [
  'browser',
  'require',
  'react-native',
];
config.resolver.extraNodeModules = {
  crypto: require.resolve('expo-crypto'),
  stream: require.resolve('readable-stream'),
};

module.exports = config;
