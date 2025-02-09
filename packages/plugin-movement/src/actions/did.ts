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
    Network,
    PrivateKey,
    PrivateKeyVariants,
} from "@aptos-labs/ts-sdk";
import { walletProvider } from "../providers/wallet";
import {
    MOVEMENT_NETWORK_CONFIG,
    DEFAULT_NETWORK
} from "../constants";

const DID_CONTRACT_ADDRESS = "0x61b96051f553d767d7e6dfcc04b04c28d793c8af3d07d3a43b4e2f8f4ca04c9f";

// Define DID content interface
export interface DIDContent extends Content {
    description?: string;
}

// Validate DID content
function isDIDContent(content: unknown): content is DIDContent {
    elizaLogger.debug("Validating DID content:", content);
    return typeof (content as DIDContent).description === "string";
}

export default {
    name: "CREATE_DID",
    similes: ["CREATE_IDENTITY", "REGISTER_DID"],
    triggers: [
        "create did",
        "register did",
        "create identity",
        "register identity",
    ],
    validate: async (_runtime: IAgentRuntime, message: Memory) => {
        elizaLogger.debug(
            "Starting DID creation validation for user:",
            message.userId
        );
        elizaLogger.debug("Message text:", message.content?.text);
        return true;
    },
    priority: 1000,
    description: "Create or retrieve a DID for the user on the Movement Network",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.debug("Starting CREATE_DID handler...");
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

            // Check if DID exists
            const didDescription = await aptosClient.view({
                payload: {
                    function: `${DID_CONTRACT_ADDRESS}::addr_aggregator::get_description`,
                    functionArguments: [movementAccount.accountAddress.toStringLong()],
                },
            });

            if (didDescription && didDescription.length > 0) {
                const didType = await aptosClient.view({
                    payload: {
                        function: `${DID_CONTRACT_ADDRESS}::addr_aggregator::get_type`,
                        functionArguments: [movementAccount.accountAddress.toStringLong()],
                    },
                });

                if (callback) {
                    callback({
                        text: `DID already exists. Description: ${didDescription[0]}, Type: ${didType[0]}`,
                        content: {
                            success: true,
                            description: didDescription[0],
                            type: didType[0],
                        },
                    });
                }
                return true;
            }

            // If DID does not exist, create one
            const content = await generateObjectDeprecated({
                runtime,
                context: composeContext({
                    state,
                    template: `Extract the description from the message. If not present, use the address as description.`,
                }),
                modelClass: ModelClass.SMALL,
            });

            const description = isDIDContent(content) && content.description
                ? content.description
                : movementAccount.accountAddress.toStringLong();

            const tx = await aptosClient.transaction.build.simple({
                sender: movementAccount.accountAddress.toStringLong(),
                data: {
                    function: `${DID_CONTRACT_ADDRESS}::addr_aggregator::create_addr_aggregator`,
                    typeArguments: [],
                    functionArguments: [movementAccount.accountAddress.toStringLong(), 2, description],
                },
            });

            const committedTransaction = await aptosClient.signAndSubmitTransaction({
                signer: movementAccount,
                transaction: tx,
            });

            await aptosClient.waitForTransaction({
                transactionHash: committedTransaction.hash,
            });

            if (callback) {
                callback({
                    text: `Successfully created DID. Description: ${description}, Type: 2`,
                    content: {
                        success: true,
                        description,
                        type: 2,
                    },
                });
            }

            return true;
        } catch (error) {
            console.error("Error during DID creation:", error);
            if (callback) {
                callback({
                    text: `Error creating DID: ${error.message}`,
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
                    text: "create Movement DID with description 'Movement Identity'",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Creating Movement DID with description 'Movement Identity'...",
                    action: "CREATE_DID",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "register Movement identity",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Registering your Movement identity...",
                    action: "CREATE_DID",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
