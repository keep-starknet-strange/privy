# privy-starknet-provider

Starknet wallet provider for React Native apps using Privy authentication and AVNU paymaster for gasless transactions.

## Features

- Privy Authentication - Seamless embedded wallet creation with email/social login
- Deterministic Key Derivation - Same user always gets the same Starknet address
- Gasless Transactions - AVNU paymaster integration for sponsored transactions
- Multi-Token Support - ETH and STRK balance tracking
- React Native Ready - Built specifically for Expo/React Native with proper polyfills
- 
## Installation

```bash
npm install @keep-starknet-strange/privy-starknet-provider
```

### Peer Dependencies

Install these required peer dependencies:

```bash
npm install react react-native expo @privy-io/expo expo-crypto
```

### Required Polyfills

Add these imports to your app's entry point (e.g., `index.js`):

```javascript
import 'fast-text-encoding';
import 'react-native-get-random-values';
import '@ethersproject/shims';
```

Install polyfill dependencies:

```bash
npm install fast-text-encoding react-native-get-random-values @ethersproject/shims readable-stream
```

### Metro Configuration

Create or update `metro.config.js` in your project root:

```javascript
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.unstable_conditionNames = ['browser', 'require', 'react-native'];

const projectRoot = __dirname;
const libraryRoot = path.resolve(projectRoot, '..'); // Adjust if needed

// Watch library directory if using local development
config.watchFolders = [libraryRoot];

// Only use your app's node_modules to avoid duplicate React
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

// Block parent node_modules if in monorepo
config.resolver.blockList = [
  new RegExp(`${libraryRoot.replace(/\//g, '\\/')}/node_modules/.*`),
];

// Configure polyfills
config.resolver.extraNodeModules = {
  crypto: require.resolve('expo-crypto'),
  stream: require.resolve('readable-stream'),
  'react': path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
};

module.exports = config;
```

## Usage

### 1. Wrap Your App

```tsx
import { PrivyProvider } from '@privy-io/expo';
import { StarknetProvider } from '@keep-starknet-strange/privy-starknet-provider';

export default function App() {
  return (
    <PrivyProvider appId="your-privy-app-id" clientId="your-privy-client-id">
      <StarknetProvider
        config={{
          rpcUrl: 'https://starknet-sepolia.g.alchemy.com/v2/YOUR_KEY',
          contractAddress: '0x...', // Optional
          avnuApiKey: 'your-avnu-api-key', // Required for gasless transactions
        }}
      >
        <YourApp />
      </StarknetProvider>
    </PrivyProvider>
  );
}
```

### 2. Use the Hook

```tsx
import { useStarknet } from '@keep-starknet-strange/privy-starknet-provider';

function MyComponent() {
  const {
    address,
    balance,
    isDeployed,
    txPending,
    executeGaslessTransaction,
  } = useStarknet();

  // Execute gasless transaction
  const handleTransaction = async () => {
    const result = await executeGaslessTransaction([
      {
        contractAddress: '0x...',
        entrypoint: 'increment',
        calldata: [],
      },
    ]);

    if (result.success) {
      console.log('Transaction successful!', result.transactionHash);
    }
  };

  return (
    <View>
      <Text>Address: {address}</Text>
      <Text>ETH Balance: {balance?.eth}</Text>
      <Text>STRK Balance: {balance?.strk}</Text>
      <Text>Deployed: {isDeployed ? 'Yes' : 'No'}</Text>

      <Button
        onPress={handleTransaction}
        disabled={txPending}
        title="Execute Transaction"
      />
    </View>
  );
}
```

## API Reference

### StarknetProvider

Context provider that wraps your app.

**Props:**

- `config` - Configuration object
  - `rpcUrl` (required) - Starknet RPC endpoint URL
  - `contractAddress` (optional) - Your smart contract address
  - `avnuApiKey` (required) - AVNU API key for gasless transactions

### useStarknet()

Hook to access Starknet wallet functionality.

**Returns:**

- `account` - Starknet account instance
- `provider` - Starknet RPC provider
- `address` - Account address (0x...)
- `privateKey` - Private key for signing
- `balance` - Balance info `{ eth: string, strk: string }`
- `isDeployed` - Whether account is deployed on-chain
- `isInitializing` - Whether initialization is in progress
- `txPending` - Whether a transaction is pending
- `error` - Current error message
- `initialize()` - Initialize Starknet account
- `refreshBalance()` - Refresh balance information
- `deployAccount()` - Deploy account on-chain (optional, can be done via gasless transaction)
- `executeGaslessTransaction(calls)` - Execute gasless transaction via AVNU paymaster
- `clearError()` - Clear error state

## Configuration

### Get API Keys

1. **Privy App ID & Client ID** - Create an app at https://dashboard.privy.io
2. **AVNU API Key** - Request at https://docs.avnu.fi
3. **Alchemy RPC** - Get key at https://alchemy.com (or use any Starknet RPC)

### Environment Variables

```bash
EXPO_PUBLIC_PRIVY_APP_ID=your_privy_app_id
EXPO_PUBLIC_PRIVY_CLIENT_ID=your_privy_client_id
EXPO_PUBLIC_AVNU_API_KEY=your_avnu_api_key
EXPO_PUBLIC_STARKNET_RPC_URL=https://starknet-sepolia.g.alchemy.com/v2/YOUR_KEY
EXPO_PUBLIC_CONTRACT_ADDRESS=0x...
```

## Example

See the `example` directory for a complete working demo.

To run the example:

```bash
cd example
npm install
npx expo start
```

## Account Model

This package uses ArgentX account contracts on Starknet Sepolia testnet:

- Deterministic address derivation from Privy user ID
- Same user always gets same Starknet address
- Account can be deployed automatically via gasless transactions
- Uses STRK as gas token when deployed

## Gasless Transactions

Gasless transactions are powered by AVNU paymaster:

- Works for both deployed and undeployed accounts
- Undeployed accounts can deploy and execute in one gasless transaction
- Deployed accounts use STRK as gas token (sponsored by AVNU)
- Requires valid AVNU API key
- Works on Starknet Sepolia testnet

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR on GitHub.

## Credits

Built with:

- Privy - Embedded wallet infrastructure
- Starknet.js - Starknet JavaScript library
- AVNU - Gasless transaction paymaster
