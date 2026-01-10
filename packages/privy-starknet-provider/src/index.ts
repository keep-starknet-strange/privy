// Main exports
export { StarknetProvider } from './StarknetProvider';
export { useStarknet } from './useStarknet';

// Type exports
export type {
  StarknetProviderConfig,
  BalanceInfo,
  DeploymentStatus,
  TransactionResult,
  StarknetContextState,
  StarknetContextActions,
  StarknetContext,
} from './types';

// Utility exports
export {
  derivePrivateKey,
  createStarknetAccount,
  createStarknetProvider,
  fetchBalances,
  checkAccountDeployment,
  generateDeploymentData,
  ETH_TOKEN_ADDRESS,
  STRK_TOKEN_ADDRESS,
  ARGENTX_CLASS_HASH,
} from './utils';
