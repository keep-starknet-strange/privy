import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { PrivyProvider, usePrivy, useLoginWithEmail, useEmbeddedWallet } from '@privy-io/expo';

// Main app content (inside Privy provider)
function AppContent() {
  const { isReady, user, logout } = usePrivy();
  const wallet = useEmbeddedWallet();
  const { sendCode, loginWithCode, state } = useLoginWithEmail({
    onError: (error) => {
      console.error('Login error:', error);
      setError(error.message || 'Login failed');
    },
    onLoginSuccess: (user, isNewUser) => {
      console.log('Login successful:', user.id, 'New user:', isNewUser);
      setError(null);
    },
  });
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [starknetAccount, setStarknetAccount] = useState<any>(null);
  const [starknetBalance, setStarknetBalance] = useState<string | null>(null);

  // Create embedded wallet after login
  useEffect(() => {
    if (user && wallet.status === 'not-created') {
      console.log('Creating embedded wallet...');
      wallet.create().catch((err) => {
        console.error('Failed to create wallet:', err);
        setError('Failed to create wallet: ' + err.message);
      });
    }
  }, [user, wallet.status]);

  // Derive Starknet account from Ethereum wallet
  useEffect(() => {
    if (wallet.status === 'connected' && wallet.account?.address && !starknetAccount) {
      console.log('Deriving Starknet account from Ethereum wallet...');

      const deriveStarknetAccount = async () => {
        try {
          const rpcUrl = process.env.EXPO_PUBLIC_STARKNET_RPC_URL || 'https://starknet-sepolia.g.alchemy.com/v2/demo';

          // TEMPORARY: For demo, create a read-only account
          // Using Ethereum address as placeholder for Starknet address
          const demoAccountAddress = '0x' + wallet.account!.address.slice(2).padStart(64, '0');

          // Create mock account with RPC methods
          const mockAccount = {
            address: demoAccountAddress,
            rpcUrl,
            // Simple RPC call method
            callRpc: async function(method: string, params: any[]) {
              console.log('RPC call:', method, 'to', this.rpcUrl);
              try {
                const response = await fetch(this.rpcUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    jsonrpc: '2.0',
                    method,
                    params,
                    id: 1,
                  }),
                });

                if (!response.ok) {
                  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();

                if (data.error) {
                  throw new Error(data.error.message);
                }
                return data.result;
              } catch (err: any) {
                console.error('RPC call failed:', err.message);
                throw err;
              }
            },
            getBalance: async function() {
              try {
                const result = await this.callRpc('starknet_getBalance', [this.address]);
                return result;
              } catch (err) {
                console.log('Balance check (expected to fail for non-deployed account)');
                return '0x0';
              }
            },
          };

          console.log('✅ Starknet read-only connection created');
          setStarknetAccount(mockAccount);

        } catch (err: any) {
          console.error('Failed to create Starknet connection:', err);
          setError('Failed to connect to Starknet: ' + err.message);
        }
      };

      deriveStarknetAccount();
    }
  }, [wallet.status, wallet.account, starknetAccount]);

  // Fetch Starknet balance
  useEffect(() => {
    if (starknetAccount) {
      console.log('Fetching Starknet balance...');

      const fetchBalance = async () => {
        try {
          const balanceHex = await starknetAccount.getBalance();
          const balanceWei = BigInt(balanceHex);
          const balanceInEth = (Number(balanceWei) / 1e18).toFixed(6);
          setStarknetBalance(balanceInEth);
        } catch (err: any) {
          console.error('Failed to fetch balance:', err);
          setStarknetBalance('0.000000');
        }
      };

      fetchBalance();
    }
  }, [starknetAccount]);

  // Read on-chain counter value
  useEffect(() => {
    if (starknetAccount) {
      console.log('Reading on-chain counter...');

      const readCounter = async () => {
        try {
          const contractAddress = process.env.EXPO_PUBLIC_CONTRACT_ADDRESS;
          if (!contractAddress) {
            console.error('Contract address not configured');
            return;
          }

          // Call get_count function using RPC
          // Actual selector from deployed contract
          const result = await starknetAccount.callRpc('starknet_call', [
            {
              contract_address: contractAddress,
              entry_point_selector: '0x20694f8b2b8fdf89588fd05fd4abdb2e3e7d9181a68d8c34872d0b2f8562aad', // get_count
              calldata: [],
            },
            'latest',
          ]);

          // Result is an array of felt252 values in hex
          if (!result || !Array.isArray(result) || result.length === 0) {
            console.log('No result data, using 0');
            setCount(0);
            return;
          }

          const counterValue = parseInt(result[0], 16);
          console.log('✅ Counter value read from blockchain:', counterValue);
          setCount(counterValue);
        } catch (err: any) {
          console.error('Failed to read counter:', err);
          if (err.message.includes('429')) {
            console.log('⚠️  RPC rate limited. Get your own Alchemy API key at https://www.alchemy.com/');
            console.log('⚠️  Add to .env: EXPO_PUBLIC_STARKNET_RPC_URL=https://starknet-sepolia.g.alchemy.com/v2/YOUR_KEY');
          }
          // For demo, show 0 when rate limited
          setCount(0);
        }
      };

      readCounter();
    }
  }, [starknetAccount]);

  // Show loading while Privy initializes
  if (!isReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.hint}>Initializing Privy...</Text>
        <Text style={styles.hint}>Check Metro console for details</Text>
      </View>
    );
  }

  // Show login screen if not authenticated
  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Simple Counter Demo</Text>
        <Text style={styles.subtitle}>Step 3: Privy Authentication</Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Login with email to create your embedded wallet
          </Text>
        </View>

        {state.status === 'initial' && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <TouchableOpacity
              style={styles.button}
              onPress={async () => {
                try {
                  console.log('Sending code to:', email);
                  setError(null);
                  await sendCode({ email });
                } catch (err: any) {
                  console.error('Send code error:', err);
                  setError(err.message || 'Failed to send code');
                }
              }}
              disabled={!email || state.status === 'sending-code'}
            >
              <Text style={styles.buttonText}>
                {state.status === 'sending-code' ? 'Sending...' : 'Send Code'}
              </Text>
            </TouchableOpacity>
          </>
        )}
        {state.status === 'awaiting-code-input' && (
          <>
            <Text style={styles.hint}>Check your email for the code</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter 6-digit code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity
              style={styles.button}
              onPress={async () => {
                try {
                  console.log('Logging in with code');
                  setError(null);
                  await loginWithCode({ code });
                } catch (err: any) {
                  console.error('Login error:', err);
                  setError(err.message || 'Invalid code');
                }
              }}
              disabled={code.length !== 6 || state.status === 'submitting-code'}
            >
              <Text style={styles.buttonText}>
                {state.status === 'submitting-code' ? 'Verifying...' : 'Verify Code'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={() => {
                setEmail('');
                setCode('');
                setError(null);
              }}
            >
              <Text style={styles.logoutText}>Use different email</Text>
            </TouchableOpacity>
          </>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <StatusBar style="auto" />
      </View>
    );
  }

  // Main app (authenticated)
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Simple Counter Demo</Text>

      {/* Wallet Info */}
      <View style={styles.walletCard}>
        <Text style={styles.walletLabel}>Ethereum Wallet</Text>
        {(() => {
          // Try to get address from wallet.account or wallet.address
          const address = wallet.account?.address || wallet.address;
          // Otherwise try to get from user's linked_accounts
          const embeddedWallet = user?.linked_accounts?.find(
            (account: any) => account.type === 'wallet' && account.wallet_client_type === 'privy'
          );
          const displayAddress = address || embeddedWallet?.address;

          return displayAddress ? (
            <Text style={styles.walletAddress}>
              {displayAddress.slice(0, 6)}...{displayAddress.slice(-4)}
            </Text>
          ) : (
            <Text style={styles.walletAddress}>Loading...</Text>
          );
        })()}
        <Text style={styles.walletEmail}>{user?.email?.address || user?.google?.email || 'Logged in'}</Text>
      </View>

      {/* Starknet Info */}
      {starknetAccount && (
        <View style={styles.walletCard}>
          <Text style={styles.walletLabel}>Starknet Account</Text>
          <Text style={styles.walletAddress}>
            {starknetAccount.address.slice(0, 6)}...{starknetAccount.address.slice(-4)}
          </Text>
          <Text style={styles.walletEmail}>
            Balance: {starknetBalance || 'Loading...'} ETH
          </Text>
        </View>
      )}

      {/* Counter */}
      <View style={styles.counterContainer}>
        <Text style={styles.count}>{count}</Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => setCount(count + 1)}
        disabled={true}
      >
        <Text style={styles.buttonText}>Coming Soon: Increment On-Chain</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        {starknetAccount ? 'Reading from blockchain...' : 'Waiting for Starknet account...'}
      </Text>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <StatusBar style="auto" />
    </View>
  );
}

// Root component with Privy provider
export default function App() {
  const privyAppId = process.env.EXPO_PUBLIC_PRIVY_APP_ID;
  const privyClientId = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID;

  if (!privyAppId || !privyClientId) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          {!privyAppId && 'Error: EXPO_PUBLIC_PRIVY_APP_ID not set'}
          {!privyClientId && '\nError: EXPO_PUBLIC_PRIVY_CLIENT_ID not set'}
        </Text>
        <Text style={styles.hint}>
          Get both from https://dashboard.privy.io
        </Text>
        <Text style={styles.hint}>
          Dashboard → Settings → App Clients
        </Text>
      </View>
    );
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      clientId={privyClientId}
      config={{
        appearance: {
          theme: 'light',
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
      }}
    >
      <AppContent />
    </PrivyProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  walletCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    marginBottom: 30,
    width: '100%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  walletLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  walletAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  walletEmail: {
    fontSize: 14,
    color: '#4A90E2',
  },
  counterContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  count: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  button: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  logoutButton: {
    marginTop: 20,
    padding: 10,
  },
  logoutText: {
    color: '#666',
    fontSize: 14,
  },
  hint: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 10,
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    padding: 20,
    borderRadius: 10,
    marginBottom: 30,
    width: '100%',
    maxWidth: 350,
  },
  infoText: {
    fontSize: 14,
    color: '#1976D2',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#D32F2F',
    marginBottom: 10,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: '#FFEBEE',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    width: '100%',
    maxWidth: 350,
  },
  input: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    width: '100%',
    maxWidth: 350,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
});
