interface Token {
    address: string;
    symbol: string;
    decimals: number;
    isNative?: boolean;
}

interface SwapParams {
    inputToken: Token;
    outputToken: Token;
    inputAmount: number | string;
    outputAmount: number | string;
}

const NATIVE_MOVE_ADDRESS = "0x1::aptos_coin::AptosCoin";

function getTokenTypeArgument(token: Token): string {
    if (token.isNative) {
        return NATIVE_MOVE_ADDRESS;
    }
    return token.address;
}

function convertTokenNameToAddress(tokenName: string): string {
    if (tokenName.toLowerCase() === "move") {
        return NATIVE_MOVE_ADDRESS;
    }
    return tokenName;
}

function convertAddressToTokenName(address: string): string {
    if (address === NATIVE_MOVE_ADDRESS) {
        return "MOVE";
    }
    const parts = address.split("::");
    return parts[parts.length - 1];
}

function formatTokenAmount(amount: number | string, decimals: number): string {
    const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return (parsedAmount * Math.pow(10, decimals)).toString();
}

export {
    Token,
    SwapParams,
    getTokenTypeArgument,
    formatTokenAmount,
    NATIVE_MOVE_ADDRESS,
    convertTokenNameToAddress,
    convertAddressToTokenName,
}; 