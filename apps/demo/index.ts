// Import polyfills FIRST - required for Privy and Starknet
import { Buffer } from 'buffer';
global.Buffer = Buffer;

import 'fast-text-encoding';
import 'react-native-get-random-values';
import '@ethersproject/shims';

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
