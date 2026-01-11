import { Account, RpcProvider } from 'starknet';

/**
 * Configuration options for the Starknet provider
 */
export interface StarknetProviderConfig {
  /** Starknet RPC endpoint URL */
  rpcUrl: string;
  /** Smart contract address for interactions */
  contractAddress?: string;
  /** AVNU API key for gasless transactions */
  avnuApiKey?: string;
}

/**
 * Balance information for wallet tokens
 */
export interface BalanceInfo {
  /** ETH balance in human-readable format */
  eth: string;
  /** STRK balance in human-readable format */
  strk: string;
}

/**
 * Account deployment status
 */
export interface DeploymentStatus {
  /** Whether the account is deployed on-chain */
  isDeployed: boolean;
  /** Error message if deployment check failed */
  error?: string;
}

/**
 * Transaction result
 */
export interface TransactionResult {
  /** Transaction hash */
  transactionHash: string;
  /** Whether the transaction was successful */
  success: boolean;
  /** Error message if transaction failed */
  error?: string;
}

/**
 * Starknet context state
 */
export interface StarknetContextState {
  /** Starknet account instance */
  account: Account | null;
  /** Starknet RPC provider */
  provider: RpcProvider | null;
  /** Account address (0x...) */
  address: string | null;
  /** Private key (for signing) */
  privateKey: string | null;
  /** Balance information */
  balance: BalanceInfo | null;
  /** Whether account is deployed */
  isDeployed: boolean;
  /** Whether initialization is in progress */
  isInitializing: boolean;
  /** Whether a transaction is pending */
  txPending: boolean;
  /** Current error message */
  error: string | null;
}

/**
 * Starknet context actions
 */
export interface StarknetContextActions {
  /** Initialize Starknet account from Privy user */
  initialize: () => Promise<void>;
  /** Refresh balance information */
  refreshBalance: () => Promise<void>;
  /** Deploy the Starknet account on-chain */
  deployAccount: () => Promise<TransactionResult>;
  /** Execute a regular transaction (user pays gas) */
  executeTransaction: (calls: any[]) => Promise<TransactionResult>;
  /** Execute a gasless transaction (AVNU sponsors gas) */
  executeGaslessTransaction: (calls: any[]) => Promise<TransactionResult>;
  /** Reset error state */
  clearError: () => void;
}

/**
 * Combined Starknet context (state + actions)
 */
export type StarknetContext = StarknetContextState & StarknetContextActions;
