export const MOVE_DECIMALS = 8;

export const MOVEMENT_NETWORK_CONFIG = {
    mainnet: {
        fullnode: 'https://mainnet.movementnetwork.xyz/v1',
        chainId: '126',
        name: 'Movement Mainnet',
        explorerNetwork: 'mainnet'
    },
    bardock: {
        fullnode: 'https://aptos.testnet.bardock.movementlabs.xyz/v1',
        chainId: '250',
        name: 'Movement Bardock Testnet',
        explorerNetwork: 'bardock+testnet'
    },
    porto: {
        fullnode: 'https://aptos.testnet.porto.movementlabs.xyz/v1',
        chainId: '177',
        name: 'Movement Porto Testnet',
        explorerNetwork: 'porto+testnet'
    }
} as const;

export const DEFAULT_NETWORK = 'porto';
export const MOVEMENT_EXPLORER_URL = 'https://explorer.movementnetwork.xyz/txn';

// Add Swap related constants
export const SWAP_ADDRESS = {
    "porto": "0xe577b40d9348496fe1f71783e0c3fc719ed05333f74c4e3d95d7688ca5b7df74",
};

export const SWAP_ADDRESS_MODULE = "router";
export const SWAP_ADDRESS_FUNCTION = "swap_exact_input";