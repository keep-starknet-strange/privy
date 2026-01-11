import { useContext } from 'react';
import { StarknetContext } from './StarknetProvider';
import type { StarknetContext as StarknetContextType } from './types';

/**
 * Hook to access Starknet wallet functionality
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { address, balance, executeTransaction } = useStarknet();
 *
 *   const handleIncrement = async () => {
 *     const result = await executeTransaction([{
 *       contractAddress: '0x...',
 *       entrypoint: 'increment',
 *       calldata: [],
 *     }]);
 *
 *     if (result.success) {
 *       console.log('Transaction hash:', result.transactionHash);
 *     }
 *   };
 *
 *   return (
 *     <View>
 *       <Text>Address: {address}</Text>
 *       <Text>ETH: {balance?.eth}</Text>
 *       <Text>STRK: {balance?.strk}</Text>
 *       <Button onPress={handleIncrement} title="Increment" />
 *     </View>
 *   );
 * }
 * ```
 */
export function useStarknet(): StarknetContextType {
  const context = useContext(StarknetContext);

  if (!context) {
    throw new Error('useStarknet must be used within a StarknetProvider');
  }

  return context;
}
