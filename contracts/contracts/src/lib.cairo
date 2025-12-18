/// Interface for the Counter contract.
#[starknet::interface]
pub trait ICounter<TContractState> {
    /// Increment the counter by 1.
    fn increment(ref self: TContractState);
    /// Get the current count value.
    fn get_count(self: @TContractState) -> u128;
}

/// Simple counter contract that stores and increments a counter.
#[starknet::contract]
mod Counter {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        counter: u128,
    }

    #[abi(embed_v0)]
    impl CounterImpl of super::ICounter<ContractState> {
        fn increment(ref self: ContractState) {
            let current = self.counter.read();
            self.counter.write(current + 1);
        }

        fn get_count(self: @ContractState) -> u128 {
            self.counter.read()
        }
    }
}
