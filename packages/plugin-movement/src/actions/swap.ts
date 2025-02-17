import { elizaLogger } from "@elizaos/core";
import {
    type ActionExample,
    type Content,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    ModelClass,
    type State,
    type Action,
} from "@elizaos/core";
import { composeContext } from "@elizaos/core";
import { generateObjectDeprecated } from "@elizaos/core";
import {
    Account,
    Aptos,
    AptosConfig,
    Ed25519PrivateKey,
    InputViewFunctionData,
    Network,
    PrivateKey,
    PrivateKeyVariants,
} from "@aptos-labs/ts-sdk";
import { walletProvider } from "../providers/wallet";
import {
    MOVEMENT_NETWORK_CONFIG,
    MOVE_DECIMALS,
    MOVEMENT_EXPLORER_URL,
    SWAP_ADDRESS,
    SWAP_ADDRESS_MODULE,
    SWAP_ADDRESS_FUNCTION,
    DEFAULT_NETWORK
} from "../constants";
import { convertAddressToTokenName, formatTokenAmount } from "../types/token";

// Define Swap content interface
export interface SwapContent extends Content {
    inputToken: string;
    outputToken: string;
    inputAmount: string | number;
}

// Validate Swap content
function isSwapContent(content: unknown): content is SwapContent {
    elizaLogger.debug("Validating swap content:", content);
    return (
        typeof (content as SwapContent).inputToken === "string" &&
        typeof (content as SwapContent).outputToken === "string" &&
        (typeof (content as SwapContent).inputAmount === "string" ||
            typeof (content as SwapContent).inputAmount === "number")
    );
}

// Swap template
const swapTemplate = `You are processing a token swap request. Extract the input token, output token, and input amount from the message.

Example request: "swap 0.1 move to yuzu"
Example response:
\`\`\`json
{
    "inputToken": "0x1::aptos_coin::AptosCoin",
    "outputToken": "0xbd9162ee6441fcf49652f0a50706279187e744aa4622a7c30bfeeaa18b7e4147::porto::YUZU",
    "inputAmount": "0.1"
}
\`\`\`

Rules:
1. For MOVE token, always use "0x1::aptos_coin::AptosCoin"
2. For YUZU token, always use "0xbd9162ee6441fcf49652f0a50706279187e744aa4622a7c30bfeeaa18b7e4147::porto::YUZU"
3. The amounts should be numeric values less than 100
4. Return exact token addresses, not symbols

Recent messages:
{{recentMessages}}

Extract and return ONLY the following in a JSON block:
- inputToken: The complete token address (not just the symbol)
- outputToken: The complete token address (not just the symbol)
- inputAmount: The numeric amount of input tokens

Return ONLY the JSON block with these fields.`;

export default {
    name: "SWAP_MOVE",
    similes: ["SWAP_TOKEN", "EXCHANGE_TOKEN", "TRADE_TOKEN"],
    triggers: [
        "swap move",
        "swap 1 move",
        "exchange move",
        "trade move",
        "swap token",
        "can you swap",
        "please swap",
        "swap",
    ],
    validate: async (_runtime: IAgentRuntime, message: Memory) => {
        elizaLogger.debug(
            "Starting swap validation for user:",
            message.userId
        );
        elizaLogger.debug("Message text:", message.content?.text);
        return true;
    },
    priority: 1000,
    description: "Swap Move tokens for other tokens on Movement Network",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.debug("Starting SWAP_MOVE handler...");
        elizaLogger.debug("Message:", {
            text: message.content?.text,
            userId: message.userId,
            action: message.content?.action,
        });

        try {
            const privateKey = runtime.getSetting("MOVEMENT_PRIVATE_KEY");
            elizaLogger.debug(
                "Got private key:",
                privateKey ? "Present" : "Missing"
            );

            const network = runtime.getSetting("MOVEMENT_NETWORK") ?? DEFAULT_NETWORK;
            elizaLogger.debug("Network config:", network);

            const movementAccount = Account.fromPrivateKey({
                privateKey: new Ed25519PrivateKey(
                    PrivateKey.formatPrivateKey(
                        privateKey,
                        PrivateKeyVariants.Ed25519
                    )
                ),
            });

            const aptosClient = new Aptos(
                new AptosConfig({
                    network: Network.CUSTOM,
                    fullnode: MOVEMENT_NETWORK_CONFIG[network].fullnode,
                })
            );

            const walletInfo = await walletProvider.get(
                runtime,
                message,
                state
            );
            state.walletInfo = walletInfo;

            // Initialize or update state
            let currentState: State;
            if (!state) {
                currentState = (await runtime.composeState(message)) as State;
            } else {
                currentState = await runtime.updateRecentMessageState(state);
            }
            // Compose swap context
            const swapContext = composeContext({
                state: currentState,
                template: swapTemplate,
            });
            // Generate swap content
            const content = await generateObjectDeprecated({
                runtime,
                context: swapContext,
                modelClass: ModelClass.SMALL,
            });
            // Validate swap content
            if (!isSwapContent(content)) {
                console.error("Invalid content for SWAP_MOVE action.");
                if (callback) {
                    callback({
                        text: "Unable to process swap request. Invalid content provided.",
                        content: { error: "Invalid swap content" },
                    });
                }
                return false;
            }

            // // Get output amount using get_amount_out view function
            // const viewPayload: InputViewFunctionData = {
            //     function: `${SWAP_ADDRESS[network]}::${SWAP_ADDRESS_MODULE}::get_amount_out`,
            //     typeArguments: [content.inputToken, content.outputToken],
            //     functionArguments: [formatTokenAmount(content.inputAmount, MOVE_DECIMALS)],
            // };
            // console.log("viewPayload", viewPayload);
            // const outputAmount = await aptosClient.view({payload: viewPayload});

            // Check if outputAmount is valid
            // if (!outputAmount || outputAmount.length === 0 || parseInt(outputAmount[0].toString()) <= 0) {
            //     console.error("Invalid output amount received from view function.");
            //     if (callback) {
            //         callback({
            //             text: "Unable to process swap request. The target token lacks sufficient liquidity.",
            //             content: { error: "Insufficient liquidity for target token" },
            //         });
            //     }
            //     return false;
            // }

            // Build swap transaction
            const tx = await aptosClient.transaction.build.simple({
                sender: movementAccount.accountAddress.toStringLong(),
                data: {
                    function: `${SWAP_ADDRESS[network]}::${SWAP_ADDRESS_MODULE}::${SWAP_ADDRESS_FUNCTION}`,
                    typeArguments: [content.inputToken, content.outputToken],
                    functionArguments: [
                        formatTokenAmount(content.inputAmount, MOVE_DECIMALS),
                        BigInt("0")
                    ],
                },
            });

            // Sign and submit transaction
            const committedTransaction = await aptosClient.signAndSubmitTransaction({
                signer: movementAccount,
                transaction: tx,
            });

            // Wait for transaction completion
            const executedTransaction = await aptosClient.waitForTransaction({
                transactionHash: committedTransaction.hash,
            });
            const explorerUrl = `${MOVEMENT_EXPLORER_URL}/${executedTransaction.hash}?network=${MOVEMENT_NETWORK_CONFIG[network].explorerNetwork}`;
            elizaLogger.debug("Swap successful:", {
                hash: executedTransaction.hash,
                inputAmount: content.inputAmount,
                explorerUrl,
            });

            if (callback) {
                callback({
                    text: `Successfully swapped ${convertAddressToTokenName(content.inputToken)} ${content.inputAmount}  ${convertAddressToTokenName(content.outputToken)}\nTransaction: ${executedTransaction.hash}\nView on Explorer: ${explorerUrl}`,
                    content: {
                        success: true,
                        hash: executedTransaction.hash,
                        inputAmount: content.inputAmount,
                        inputToken: content.inputToken,
                        outputToken: content.outputToken,
                        explorerUrl,
                    },
                });
            }

            return true;
        } catch (error) {
            console.error("Error during token swap:", error);
            if (callback) {
                callback({
                    text: `Error swapping tokens: ${error.message}`,
                    content: { error: error.message },
                });
            }
            return false;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "can you swap 1 move to yuzu",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll help you swap 1 Move token for Yuzu...",
                    action: "SWAP_MOVE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "swap 1 move for yuzu",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Processing Move token swap...",
                    action: "SWAP_MOVE",
                },
            },
        ],
    ] as ActionExample[][],
} as Action; 