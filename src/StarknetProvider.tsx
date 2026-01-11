import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { usePrivy } from '@privy-io/expo';
import { executeCalls, SEPOLIA_BASE_URL, GaslessOptions } from '@avnu/gasless-sdk';
import { ec, CallData } from 'starknet';
import type {
  StarknetContext,
  StarknetProviderConfig,
  BalanceInfo,
  TransactionResult,
} from './types';
import {
  derivePrivateKey,
  createStarknetAccount,
  createStarknetProvider,
  fetchBalances,
  checkAccountDeployment,
  generateDeploymentData,
  ARGENTX_CLASS_HASH,
  STRK_TOKEN_ADDRESS,
} from './utils';

export const StarknetContext = createContext<StarknetContext | null>(null);

interface StarknetProviderProps {
  children: ReactNode;
  config: StarknetProviderConfig;
}

export function StarknetProvider({ children, config }: StarknetProviderProps) {
  const { user } = usePrivy();

  const [account, setAccount] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [isDeployed, setIsDeployed] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [txPending, setTxPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Starknet account when Privy user is logged in
  useEffect(() => {
    if (user) {
      initialize();
    } else {
      // Reset state when user logs out
      setAccount(null);
      setProvider(null);
      setAddress(null);
      setPrivateKey(null);
      setBalance(null);
      setIsDeployed(false);
      setError(null);
    }
  }, [user]);

  // Auto-refresh balance every 10 seconds when account exists
  useEffect(() => {
    if (account && provider) {
      const interval = setInterval(() => {
        refreshBalance();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [account, provider]);

  const initialize = async () => {
    if (!user || !config.rpcUrl) {
      setError('Missing user or RPC URL');
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      // Create Starknet provider
      const starknetProvider = createStarknetProvider(config.rpcUrl);

      // Derive deterministic private key from Privy user ID
      const userSeed = user.id;
      const derivedPrivateKey = await derivePrivateKey(userSeed);

      // Create Starknet account
      const starknetAccount = createStarknetAccount(derivedPrivateKey, starknetProvider);

      // Set state
      setProvider(starknetProvider);
      setAccount(starknetAccount);
      setAddress(starknetAccount.address);
      setPrivateKey(derivedPrivateKey);

      // Fetch initial balance and deployment status
      const balances = await fetchBalances(starknetProvider, starknetAccount.address);
      setBalance(balances);

      const deploymentStatus = await checkAccountDeployment(
        starknetProvider,
        starknetAccount.address
      );
      setIsDeployed(deploymentStatus.isDeployed);

      console.log('✅ Starknet account initialized:', starknetAccount.address);
    } catch (err: any) {
      console.error('Failed to initialize Starknet account:', err);
      setError(err.message || 'Failed to initialize Starknet account');
    } finally {
      setIsInitializing(false);
    }
  };

  const refreshBalance = async () => {
    if (!provider || !address) return;

    try {
      const balances = await fetchBalances(provider, address);
      setBalance(balances);
    } catch (err: any) {
      console.error('Failed to refresh balance:', err);
    }
  };

  const deployAccount = async (): Promise<TransactionResult> => {
    if (!account || !provider || !privateKey) {
      return { transactionHash: '', success: false, error: 'Account not initialized' };
    }

    setTxPending(true);
    setError(null);

    try {
      console.log('🚀 Deploying Starknet account...');

      const starkKeyPub = ec.starkCurve.getStarkKey(privateKey);
      const constructorCalldata = CallData.compile({
        owner: starkKeyPub,
        guardian: '0x0',
      });

      const { transaction_hash } = await account.deployAccount({
        classHash: ARGENTX_CLASS_HASH,
        constructorCalldata,
        addressSalt: starkKeyPub,
        contractAddress: account.address,
      });

      console.log('📡 Waiting for deployment confirmation...');
      await provider.waitForTransaction(transaction_hash);

      console.log('✅ Account deployed successfully!');
      setIsDeployed(true);

      // Refresh balance after deployment
      await refreshBalance();

      return { transactionHash: transaction_hash, success: true };
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to deploy account';
      console.error('Deployment failed:', errorMsg);
      setError(errorMsg);
      return { transactionHash: '', success: false, error: errorMsg };
    } finally {
      setTxPending(false);
    }
  };

  const executeTransaction = async (calls: any[]): Promise<TransactionResult> => {
    if (!account || !provider) {
      return { transactionHash: '', success: false, error: 'Account not initialized' };
    }

    setTxPending(true);
    setError(null);

    try {
      console.log('🚀 Executing transaction...');

      // Try to execute with auto fee estimation
      const result = await account.execute(calls);

      console.log('📡 Waiting for transaction confirmation...');
      await provider.waitForTransaction(result.transaction_hash);

      console.log('✅ Transaction confirmed!');

      // Refresh balance after transaction
      await refreshBalance();

      return { transactionHash: result.transaction_hash, success: true };
    } catch (err: any) {
      const errorMsg = err.message || 'Transaction failed';
      console.error('Transaction error:', errorMsg);
      setError(errorMsg);
      return { transactionHash: '', success: false, error: errorMsg };
    } finally {
      setTxPending(false);
    }
  };

  const executeGaslessTransaction = async (calls: any[]): Promise<TransactionResult> => {
    if (!account || !provider || !privateKey || !config.avnuApiKey) {
      return {
        transactionHash: '',
        success: false,
        error: 'Account not initialized or AVNU API key missing',
      };
    }

    setTxPending(true);
    setError(null);

    try {
      console.log('🚀 Executing gasless transaction with AVNU...');

      // Check if account is deployed
      const deploymentStatus = await checkAccountDeployment(provider, account.address);
      const deploymentData = deploymentStatus.isDeployed
        ? undefined
        : generateDeploymentData(privateKey);

      // Configure AVNU gasless options
      const gaslessOptions: GaslessOptions = {
        baseUrl: SEPOLIA_BASE_URL,
        customHeaders: {
          'x-api-key': config.avnuApiKey,
        },
      };

      // Execute gasless transaction
      const result = await executeCalls(
        account,
        calls,
        {
          gasTokenAddress: deploymentData ? undefined : STRK_TOKEN_ADDRESS,
          maxGasTokenAmount: deploymentData ? undefined : BigInt(100_000_000_000_000_000),
          deploymentData,
        },
        gaslessOptions
      );

      console.log('📡 Waiting for gasless transaction confirmation...');
      await provider.waitForTransaction(result.transactionHash);

      console.log('✅ Gasless transaction confirmed!');

      // Update deployment status if this was a deployment
      if (deploymentData) {
        setIsDeployed(true);
      }

      // Refresh balance after transaction
      await refreshBalance();

      return { transactionHash: result.transactionHash, success: true };
    } catch (err: any) {
      const errorMsg = err.message || 'Gasless transaction failed';
      console.error('Gasless transaction error:', errorMsg);
      setError(errorMsg);
      return { transactionHash: '', success: false, error: errorMsg };
    } finally {
      setTxPending(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const contextValue: StarknetContext = {
    account,
    provider,
    address,
    privateKey,
    balance,
    isDeployed,
    isInitializing,
    txPending,
    error,
    initialize,
    refreshBalance,
    deployAccount,
    executeTransaction,
    executeGaslessTransaction,
    clearError,
  };

  return <StarknetContext.Provider value={contextValue}>{children}</StarknetContext.Provider>;
}
