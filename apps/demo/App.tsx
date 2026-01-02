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

  // Debug logging
  console.log('Privy state:', {
    isReady,
    hasUser: !!user,
    loginState: state,
    walletStatus: wallet.status,
    walletAddress: wallet.address,
    walletAccount: wallet.account,
    userLinkedAccounts: user?.linked_accounts?.length
  });


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
        <Text style={styles.walletLabel}>
          {wallet.status === 'creating' && 'Creating Wallet...'}
          {wallet.status === 'connected' && 'Ethereum Wallet'}
          {wallet.status === 'not-created' && 'No Wallet Yet'}
          {wallet.status === 'disconnected' && 'Disconnected'}
        </Text>
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

      {/* Counter */}
      <View style={styles.counterContainer}>
        <Text style={styles.count}>{count}</Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => setCount(count + 1)}
      >
        <Text style={styles.buttonText}>Click Me!</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>Local counter (not on-chain yet)</Text>

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
