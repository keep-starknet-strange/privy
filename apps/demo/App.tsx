import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { PrivyProvider, usePrivy, useLoginWithEmail, useEmbeddedWallet } from '@privy-io/expo';
import { StarknetProvider, useStarknet } from '../../packages/privy-starknet-provider/src';

// Main app content (inside Privy provider)
function AppContent() {
  console.log('🎯 AppContent rendering');

  const { isReady, user, logout } = usePrivy();
  const wallet = useEmbeddedWallet();

  console.log('👤 User state:', { isReady, hasUser: !!user, walletStatus: wallet.status });

  const { sendCode, loginWithCode, state } = useLoginWithEmail({
    onError: (error) => {
      console.error('Login error:', error);
      setLoginError(error.message || 'Login failed');
    },
    onLoginSuccess: (user, isNewUser) => {
      console.log('Login successful:', user.id, 'New user:', isNewUser);
      setLoginError(null);
    },
  });

  console.log('🔌 About to call useStarknet...');

  // Starknet integration via package hook
  const {
    address: starknetAddress,
    balance: starknetBalance,
    isDeployed,
    txPending,
    error: starknetError,
    deployAccount,
    executeTransaction,
    executeGaslessTransaction,
    provider: starknetProvider,
  } = useStarknet();

  console.log('✅ useStarknet returned:', {
    hasAddress: !!starknetAddress,
    hasBalance: !!starknetBalance,
    hasProvider: !!starknetProvider
  });

  const [count, setCount] = useState(0);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  // Create embedded wallet after login
  useEffect(() => {
    if (user && wallet.status === 'not-created') {
      console.log('Creating embedded wallet...');
      wallet.create().catch((err) => {
        console.error('Failed to create wallet:', err);
        setLoginError('Failed to create wallet: ' + err.message);
      });
    }
  }, [user, wallet.status]);

  // Deploy account handler
  const handleDeployAccount = async () => {
    const result = await deployAccount();
    if (result.success) {
      console.log('✅ Account deployed!', result.transactionHash);
    }
  };

  // Increment counter transaction (regular - user pays gas)
  const handleIncrement = async () => {
    const contractAddress = process.env.EXPO_PUBLIC_CONTRACT_ADDRESS;
    if (!contractAddress) {
      return;
    }

    const result = await executeTransaction([
      {
        contractAddress,
        entrypoint: 'increment',
        calldata: [],
      },
    ]);

    if (result.success) {
      console.log('✅ Transaction confirmed!');
      // Refresh counter after delay
      setTimeout(() => refreshCounter(), 2000);
    }
  };

  // Increment counter using AVNU Paymaster (gasless)
  const handleIncrementGasless = async () => {
    const contractAddress = process.env.EXPO_PUBLIC_CONTRACT_ADDRESS;
    if (!contractAddress) {
      return;
    }

    const result = await executeGaslessTransaction([
      {
        contractAddress,
        entrypoint: 'increment',
        calldata: [],
      },
    ]);

    if (result.success) {
      console.log('✅ Gasless transaction confirmed!');
      // Refresh counter after delay
      setTimeout(() => refreshCounter(), 2000);
    }
  };

  // Read on-chain counter value
  const refreshCounter = async () => {
    if (!starknetProvider) return;

    try {
      const contractAddress = process.env.EXPO_PUBLIC_CONTRACT_ADDRESS;
      if (!contractAddress) {
        console.error('Contract address not configured');
        return;
      }

      const result = await starknetProvider.callContract({
        contractAddress,
        entrypoint: 'get_count',
        calldata: [],
      });

      const counterValue = Number(result[0]);
      console.log('✅ Counter value read from blockchain:', counterValue);
      setCount(counterValue);
    } catch (err: any) {
      console.error('Failed to read counter:', err);
      if (err.message.includes('429')) {
        console.log('⚠️  RPC rate limited. Get your own Alchemy API key at https://www.alchemy.com/');
      }
      setCount(0);
    }
  };

  // Initial counter fetch
  useEffect(() => {
    if (starknetAddress && starknetProvider) {
      refreshCounter();
    }
  }, [starknetAddress, starknetProvider]);

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
        <Text style={styles.subtitle}>Privy + Starknet Integration</Text>

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
                  setLoginError(null);
                  await sendCode({ email });
                } catch (err: any) {
                  console.error('Send code error:', err);
                  setLoginError(err.message || 'Failed to send code');
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
                  setLoginError(null);
                  await loginWithCode({ code });
                } catch (err: any) {
                  console.error('Login error:', err);
                  setLoginError(err.message || 'Invalid code');
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
                setLoginError(null);
              }}
            >
              <Text style={styles.logoutText}>Use different email</Text>
            </TouchableOpacity>
          </>
        )}

        {loginError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{loginError}</Text>
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
          const address = wallet.account?.address;
          return address ? (
            <Text style={styles.walletAddress}>
              {address.slice(0, 6)}...{address.slice(-4)}
            </Text>
          ) : (
            <Text style={styles.walletAddress}>Loading...</Text>
          );
        })()}
        <Text style={styles.walletEmail}>{(user as any)?.email?.address || 'Logged in'}</Text>
      </View>

      {/* Starknet Info */}
      {starknetAddress && (
        <View style={styles.walletCard}>
          <Text style={styles.walletLabel}>Starknet Account</Text>
          <Text style={styles.walletAddress}>
            {starknetAddress.slice(0, 6)}...{starknetAddress.slice(-4)}
          </Text>
          <Text style={styles.walletEmail}>
            ETH: {starknetBalance?.eth || 'Loading...'}
          </Text>
          <Text style={styles.walletEmail}>
            STRK: {starknetBalance?.strk || 'Loading...'}
          </Text>
        </View>
      )}

      {/* Counter */}
      <View style={styles.counterContainer}>
        <Text style={styles.count}>{count}</Text>
      </View>

      <TouchableOpacity
        style={[styles.deployButton, (txPending || !starknetAddress) && styles.buttonDisabled]}
        onPress={handleDeployAccount}
        disabled={txPending || !starknetAddress}
      >
        <Text style={styles.buttonText}>
          {txPending ? 'Processing...' : '🚀 Deploy Account'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, (txPending || !starknetAddress) && styles.buttonDisabled]}
        onPress={handleIncrement}
        disabled={txPending || !starknetAddress}
      >
        <Text style={styles.buttonText}>
          {txPending ? 'Processing...' : 'Increment (Pay Gas)'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.buttonGasless, (txPending || !starknetAddress) && styles.buttonDisabled]}
        onPress={handleIncrementGasless}
        disabled={txPending || !starknetAddress}
      >
        <Text style={styles.buttonText}>
          {txPending ? 'Processing...' : '⚡ Increment (Gasless)'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        {starknetAddress
          ? `✅ Starknet account ${isDeployed ? 'deployed' : 'ready (not deployed)'}`
          : 'Initializing Starknet account...'}
      </Text>

      {(starknetError || loginError) && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{starknetError || loginError}</Text>
        </View>
      )}

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
  const rpcUrl = process.env.EXPO_PUBLIC_STARKNET_RPC_URL;
  const contractAddress = process.env.EXPO_PUBLIC_CONTRACT_ADDRESS;
  const avnuApiKey = process.env.EXPO_PUBLIC_AVNU_API_KEY;

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

  if (!rpcUrl) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Error: EXPO_PUBLIC_STARKNET_RPC_URL not set
        </Text>
        <Text style={styles.hint}>
          Get an RPC URL from https://alchemy.com
        </Text>
      </View>
    );
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      clientId={privyClientId}
      config={{
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
      } as any}
    >
      <StarknetProvider
        config={{
          rpcUrl,
          contractAddress,
          avnuApiKey,
        }}
      >
        <AppContent />
      </StarknetProvider>
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
  buttonGasless: {
    backgroundColor: '#10B981',
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
  deployButton: {
    backgroundColor: '#F59E0B',
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
  buttonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
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
