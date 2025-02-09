import type { Plugin } from "@elizaos/core";
import transferToken from "./actions/transfer";
import swapToken from "./actions/swap";
import createDID from "./actions/did";
import { WalletProvider, walletProvider } from "./providers/wallet";

export { WalletProvider, transferToken as TransferMovementToken, swapToken as SwapMovementToken };

export const movementPlugin: Plugin = {
    name: "movement",
    description: "Movement Network Plugin for Eliza",
    actions: [transferToken, swapToken, createDID],
    evaluators: [],
    providers: [walletProvider],
};

export default movementPlugin;
