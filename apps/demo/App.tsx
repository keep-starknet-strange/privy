import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { PrivyProvider, usePrivy, useLoginWithEmail, useEmbeddedWallet } from '@privy-io/expo';
import { Account, RpcProvider, constants, ec, hash, CallData, stark } from 'starknet';
import * as Crypto from 'expo-crypto';
import { executeCalls, SEPOLIA_BASE_URL, GaslessOptions } from '@avnu/gasless-sdk';

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
  const [starknetProvider, setStarknetProvider] = useState<RpcProvider | null>(null);
  const [starknetBalance, setStarknetBalance] = useState<string | null>(null);
  const [strkBalance, setStrkBalance] = useState<string | null>(null);
  const [txPending, setTxPending] = useState(false);
  const [starknetPrivateKey, setStarknetPrivateKey] = useState<string | null>(null);

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
      console.log('Creating Starknet account...');

      const createStarknetAccount = async () => {
        try {
          const rpcUrl = process.env.EXPO_PUBLIC_STARKNET_RPC_URL || 'https://starknet-sepolia.g.alchemy.com/v2/demo';

          // Step 1: Derive Starknet private key from Privy user ID
          // This makes it deterministic - same user always gets same Starknet account
          console.log('Deriving Starknet private key from Privy user...');

          // Hash the user ID to get a deterministic seed
          const userSeed = user?.id || wallet.account?.address || 'default-seed';
          const seedHash = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            userSeed
          );

          // Use the hash as private key (deterministic!)
          // Take first 63 hex chars (252 bits) to ensure it's within valid Stark curve range
          const privateKeyHex = '0x' + seedHash.slice(2, 65);

          console.log('Starknet key derived from user:', user?.id);

          // Step 3: Create Starknet provider
          const starknetProvider = new RpcProvider({
            nodeUrl: rpcUrl,
            chainId: constants.StarknetChainId.SN_SEPOLIA,
          });

          // Step 4: Calculate account address using ArgentX account class hash
          // This is the standard way to derive the account address
          const argentXClassHash = '0x01a736d6ed154502257f02b1ccdf4d9d1089f80811cd6acad48e6b6a9d1f2003';
          const starkKeyPub = ec.starkCurve.getStarkKey(privateKeyHex);

          const constructorCalldata = CallData.compile({
            owner: starkKeyPub,
            guardian: '0x0',
          });

          const accountAddress = hash.calculateContractAddressFromHash(
            starkKeyPub,
            argentXClassHash,
            constructorCalldata,
            0,
          );

          console.log('Starknet account address:', accountAddress);

          // Step 5: Create Account instance
          const account = new Account(
            starknetProvider,
            accountAddress,
            privateKeyHex,
          );

          // Store the private key, provider, and account
          setStarknetPrivateKey(privateKeyHex);
          setStarknetProvider(starknetProvider);
          setStarknetAccount(account);

          console.log('✅ Starknet account created successfully');

        } catch (err: any) {
          console.error('Failed to create Starknet connection:', err);
          setError('Failed to connect to Starknet: ' + err.message);
        }
      };

      createStarknetAccount();
    }
  }, [wallet.status, wallet.account, starknetAccount]);

  // Fetch Starknet balances (ETH and STRK)
  useEffect(() => {
    if (starknetAccount && starknetProvider) {
      console.log('Fetching Starknet balances...');

      const fetchBalances = async () => {
        try {
          // ETH token contract
          const ETH_TOKEN = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
          const ethResult = await starknetProvider.callContract({
            contractAddress: ETH_TOKEN,
            entrypoint: 'balanceOf',
            calldata: [starknetAccount.address],
          });
          const ethBalanceWei = BigInt(ethResult[0] || '0x0');
          const ethBalance = (Number(ethBalanceWei) / 1e18).toFixed(6);
          setStarknetBalance(ethBalance);

          // STRK token contract
          const STRK_TOKEN = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
          const strkResult = await starknetProvider.callContract({
            contractAddress: STRK_TOKEN,
            entrypoint: 'balanceOf',
            calldata: [starknetAccount.address],
          });
          const strkBalanceWei = BigInt(strkResult[0] || '0x0');
          const strkBalance = (Number(strkBalanceWei) / 1e18).toFixed(6);
          setStrkBalance(strkBalance);
        } catch (err: any) {
          console.error('Failed to fetch balances:', err);
          setStarknetBalance('0.000000');
          setStrkBalance('0.000000');
        }
      };

      fetchBalances();
    }
  }, [starknetAccount, starknetProvider]);

  // Deploy account
  const handleDeployAccount = async () => {
    if (!starknetAccount || !starknetPrivateKey) {
      setError('Starknet account not ready');
      return;
    }

    setTxPending(true);
    setError(null);

    try {
      console.log('🚀 Deploying Starknet account...');

      const argentXClassHash = '0x01a736d6ed154502257f02b1ccdf4d9d1089f80811cd6acad48e6b6a9d1f2003';
      const starkKeyPub = ec.starkCurve.getStarkKey(starknetPrivateKey);
      const constructorCalldata = CallData.compile({
        owner: starkKeyPub,
        guardian: '0x0',
      });

      const { transaction_hash } = await starknetAccount.deployAccount(
        {
          classHash: argentXClassHash,
          constructorCalldata,
          addressSalt: starkKeyPub,
          contractAddress: starknetAccount.address,
        },
        {
          maxFee: 100_000_000_000_000_000, // Higher max fee for STRK
          version: 3, // Use v3 transaction for STRK gas payment
        }
      );

      console.log('✅ Account deployment submitted!');
      console.log('Transaction hash:', transaction_hash);

      // Wait for deployment confirmation
      console.log('⏳ Waiting for deployment confirmation...');
      await starknetProvider!.waitForTransaction(transaction_hash);

      console.log('✅ Account deployed successfully!');
      setError('✅ Account deployed! You can now send transactions.');

    } catch (err: any) {
      console.error('Account deployment failed:', err);
      const errorMsg = err.message || 'Failed to deploy account';

      if (errorMsg.includes('insufficient')) {
        setError('Insufficient balance. Need ETH for deployment fees.');
      } else {
        setError('Deployment failed: ' + errorMsg);
      }
    } finally {
      setTxPending(false);
    }
  };

  // Increment counter transaction
  const handleIncrement = async () => {
    if (!starknetAccount || !starknetPrivateKey) {
      setError('Starknet account not ready');
      return;
    }

    setTxPending(true);
    setError(null);

    try {
      console.log('🚀 Attempting to increment counter...');

      const contractAddress = process.env.EXPO_PUBLIC_CONTRACT_ADDRESS;
      if (!contractAddress) {
        throw new Error('Contract address not configured');
      }

      // Execute increment transaction using starknet.js SDK
      const result = await starknetAccount.execute(
        [
          {
            contractAddress,
            entrypoint: 'increment',
            calldata: [],
          },
        ],
        {
          maxFee: 100_000_000_000_000, // 0.0001 ETH max fee
        },
      );

      console.log('✅ Transaction submitted!');
      console.log('Transaction hash:', result.transaction_hash);

      // Wait for transaction confirmation
      console.log('⏳ Waiting for confirmation...');
      await starknetProvider!.waitForTransaction(result.transaction_hash);

      console.log('✅ Transaction confirmed on-chain!');
      setError(null);

      // Refresh counter value after a short delay
      setTimeout(async () => {
        try {
          if (starknetProvider) {
            const result = await starknetProvider.callContract({
              contractAddress,
              entrypoint: 'get_count',
              calldata: [],
            });
            const newCount = Number(result[0]);
            setCount(newCount);
            console.log('✅ Counter updated to:', newCount);
          }
        } catch (err) {
          console.error('Failed to refresh counter:', err);
        }
      }, 2000);

    } catch (err: any) {
      console.error('Transaction failed:', err);
      const errorMsg = err.message || 'Failed to submit transaction';

      // Check for specific error types
      if (errorMsg.includes('Account not found') || errorMsg.includes('Contract not found')) {
        setError('Account not deployed yet. Please deploy your Starknet account first.');
      } else if (errorMsg.includes('insufficient')) {
        setError('Insufficient balance for transaction fees.');
      } else {
        setError(errorMsg);
      }
    } finally {
      setTxPending(false);
    }
  };

  // Increment counter using AVNU Paymaster (gasless)
  const handleIncrementGasless = async () => {
    if (!starknetAccount || !starknetPrivateKey) {
      setError('Starknet account not ready');
      return;
    }

    setTxPending(true);
    setError(null);

    try {
      console.log('🚀 Attempting gasless increment with AVNU paymaster...');

      const contractAddress = process.env.EXPO_PUBLIC_CONTRACT_ADDRESS;
      if (!contractAddress) {
        throw new Error('Contract address not configured');
      }

      const avnuApiKey = process.env.EXPO_PUBLIC_AVNU_API_KEY;
      if (!avnuApiKey) {
        throw new Error('AVNU API key not configured');
      }

      // Build the calls array
      const calls = [
        {
          contractAddress,
          entrypoint: 'increment',
          calldata: [],
        },
      ];

      // Check if account is deployed
      let deploymentData;
      try {
        await starknetProvider!.getClassHashAt(starknetAccount.address);
        console.log('✅ Account already deployed');
      } catch (err) {
        console.log('⚠️ Account not deployed, preparing deployment data...');

        // Prepare deployment data for AVNU paymaster to deploy the account
        const argentXClassHash = '0x01a736d6ed154502257f02b1ccdf4d9d1089f80811cd6acad48e6b6a9d1f2003';
        const starkKeyPub = ec.starkCurve.getStarkKey(starknetPrivateKey);

        // For ArgentX, calldata is simply [owner, guardian] in hex format
        deploymentData = {
          class_hash: argentXClassHash,
          salt: starkKeyPub,
          unique: '0x0',
          calldata: [starkKeyPub, '0x0'],
        };

        console.log('📦 Deployment data prepared - paymaster will deploy account');
      }

      // Configure AVNU gasless options
      const gaslessOptions: GaslessOptions = {
        baseUrl: SEPOLIA_BASE_URL,
        customHeaders: {
          'x-api-key': avnuApiKey,
        },
      };

      // Execute gasless transaction
      console.log('📡 Calling AVNU paymaster...');

      // STRK token address for gas payment
      const STRK_TOKEN = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

      const result = await executeCalls(
        starknetAccount,
        calls,
        {
          gasTokenAddress: deploymentData ? undefined : STRK_TOKEN,
          maxGasTokenAmount: deploymentData ? undefined : BigInt(100_000_000_000_000_000), // 0.1 STRK max
          deploymentData,
        },
        gaslessOptions
      );

      console.log('✅ Gasless transaction submitted!');
      console.log('Transaction hash:', result.transactionHash);

      // Wait for transaction confirmation
      console.log('⏳ Waiting for confirmation...');
      await starknetProvider!.waitForTransaction(result.transactionHash);

      console.log('✅ Gasless transaction confirmed on-chain!');
      setError(null);

      // Refresh counter value after a short delay
      setTimeout(async () => {
        try {
          if (starknetProvider) {
            const result = await starknetProvider.callContract({
              contractAddress,
              entrypoint: 'get_count',
              calldata: [],
            });
            const newCount = Number(result[0]);
            setCount(newCount);
            console.log('✅ Counter updated to:', newCount);
          }
        } catch (err) {
          console.error('Failed to refresh counter:', err);
        }
      }, 2000);

    } catch (err: any) {
      console.error('Gasless transaction failed:', err);
      const errorMsg = err.message || 'Failed to submit gasless transaction';

      // Check for specific error types
      if (errorMsg.includes('401')) {
        setError('⚠️ AVNU API key invalid or requires authorization. Contact AVNU team for API access at https://docs.avnu.fi. Use "Increment (Pay Gas)" instead.');
      } else if (errorMsg.includes('not compatible')) {
        setError('Account not compatible with gasless transactions.');
      } else if (errorMsg.includes('AVNU') || errorMsg.includes('paymaster')) {
        setError('AVNU Paymaster error: ' + errorMsg);
      } else {
        setError(errorMsg);
      }
    } finally {
      setTxPending(false);
    }
  };

  // Read on-chain counter value
  useEffect(() => {
    if (starknetAccount && starknetProvider) {
      console.log('Reading on-chain counter...');

      const readCounter = async () => {
        try {
          const contractAddress = process.env.EXPO_PUBLIC_CONTRACT_ADDRESS;
          if (!contractAddress) {
            console.error('Contract address not configured');
            return;
          }

          // Call contract directly using provider.callContract
          const result = await starknetProvider.callContract({
            contractAddress,
            entrypoint: 'get_count',
            calldata: [],
          });

          // Result is an array of field elements
          const counterValue = Number(result[0]);
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
  }, [starknetAccount, starknetProvider]);

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
            ETH: {starknetBalance || 'Loading...'}
          </Text>
          <Text style={styles.walletEmail}>
            STRK: {strkBalance || 'Loading...'}
          </Text>
        </View>
      )}

      {/* Counter */}
      <View style={styles.counterContainer}>
        <Text style={styles.count}>{count}</Text>
      </View>

      <TouchableOpacity
        style={[styles.deployButton, (txPending || !starknetPrivateKey) && styles.buttonDisabled]}
        onPress={handleDeployAccount}
        disabled={txPending || !starknetPrivateKey}
      >
        <Text style={styles.buttonText}>
          {txPending ? 'Processing...' : '🚀 Deploy Account'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, (txPending || !starknetPrivateKey) && styles.buttonDisabled]}
        onPress={handleIncrement}
        disabled={txPending || !starknetPrivateKey}
      >
        <Text style={styles.buttonText}>
          {txPending ? 'Processing...' : 'Increment (Pay Gas)'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.buttonGasless, (txPending || !starknetPrivateKey) && styles.buttonDisabled]}
        onPress={handleIncrementGasless}
        disabled={txPending || !starknetPrivateKey}
      >
        <Text style={styles.buttonText}>
          {txPending ? 'Processing...' : '⚡ Increment (Gasless)'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        {starknetPrivateKey
          ? '✅ Starknet key derived - ready for transactions'
          : 'Deriving Starknet account...'}
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
