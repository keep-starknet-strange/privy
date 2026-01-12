import * as Crypto from 'expo-crypto';
import { Account, RpcProvider, constants, ec, hash, CallData } from 'starknet';
import type { BalanceInfo, DeploymentStatus } from './types';

/** Starknet Sepolia ETH token address */
export const ETH_TOKEN_ADDRESS = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';

/** Starknet Sepolia STRK token address */
export const STRK_TOKEN_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

/** ArgentX account class hash */
export const ARGENTX_CLASS_HASH = '0x01a736d6ed154502257f02b1ccdf4d9d1089f80811cd6acad48e6b6a9d1f2003';

/**
 * Derives a deterministic Starknet private key from a user seed
 * @param userSeed - Unique user identifier (e.g., Privy user ID)
 * @returns Deterministic private key in hex format
 */
export async function derivePrivateKey(userSeed: string): Promise<string> {
  const seedHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    userSeed
  );
  // Take first 63 hex chars (252 bits) to ensure within valid Stark curve range
  return '0x' + seedHash.slice(2, 65);
}

/**
 * Creates a Starknet account from a private key
 * @param privateKey - Private key in hex format
 * @param provider - Starknet RPC provider
 * @returns Starknet Account instance
 */
export function createStarknetAccount(
  privateKey: string,
  provider: RpcProvider
): Account {
  const starkKeyPub = ec.starkCurve.getStarkKey(privateKey);
  const constructorCalldata = CallData.compile({
    owner: starkKeyPub,
    guardian: '0x0',
  });

  const accountAddress = hash.calculateContractAddressFromHash(
    starkKeyPub,
    ARGENTX_CLASS_HASH,
    constructorCalldata,
    0
  );

  return new Account({
    provider,
    address: accountAddress,
    signer: privateKey,
  });
}

/**
 * Creates a Starknet RPC provider
 * @param rpcUrl - RPC endpoint URL
 * @returns Starknet RpcProvider instance
 */
export function createStarknetProvider(rpcUrl: string): RpcProvider {
  return new RpcProvider({
    nodeUrl: rpcUrl,
    chainId: constants.StarknetChainId.SN_SEPOLIA,
  });
}

/**
 * Fetches ETH and STRK balances for an account
 * @param provider - Starknet RPC provider
 * @param accountAddress - Account address to check
 * @returns Balance information
 */
export async function fetchBalances(
  provider: RpcProvider,
  accountAddress: string
): Promise<BalanceInfo> {
  try {
    // Fetch ETH balance
    const ethResult = await provider.callContract({
      contractAddress: ETH_TOKEN_ADDRESS,
      entrypoint: 'balanceOf',
      calldata: [accountAddress],
    });
    const ethBalance = (Number(BigInt(ethResult[0])) / 1e18).toFixed(6);

    // Fetch STRK balance
    const strkResult = await provider.callContract({
      contractAddress: STRK_TOKEN_ADDRESS,
      entrypoint: 'balanceOf',
      calldata: [accountAddress],
    });
    const strkBalance = (Number(BigInt(strkResult[0])) / 1e18).toFixed(6);

    return {
      eth: ethBalance,
      strk: strkBalance,
    };
  } catch (err) {
    console.error('Failed to fetch balances:', err);
    return {
      eth: '0.000000',
      strk: '0.000000',
    };
  }
}

/**
 * Checks if an account is deployed on-chain
 * @param provider - Starknet RPC provider
 * @param accountAddress - Account address to check
 * @returns Deployment status
 */
export async function checkAccountDeployment(
  provider: RpcProvider,
  accountAddress: string
): Promise<DeploymentStatus> {
  try {
    await provider.getClassHashAt(accountAddress);
    return { isDeployed: true };
  } catch (err: any) {
    if (err.message?.includes('Contract not found')) {
      return { isDeployed: false };
    }
    return { isDeployed: false, error: err.message };
  }
}

/**
 * Generates deployment data for AVNU paymaster
 * @param privateKey - Private key for the account
 * @returns Deployment data object
 */
export function generateDeploymentData(privateKey: string) {
  const starkKeyPub = ec.starkCurve.getStarkKey(privateKey);

  return {
    class_hash: ARGENTX_CLASS_HASH,
    salt: starkKeyPub,
    unique: '0x0',
    calldata: [starkKeyPub, '0x0'],
  };
}
