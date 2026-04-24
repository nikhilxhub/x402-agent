import dotenv from "dotenv";
dotenv.config();


export const ENV = {

    SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
    UMBRA_NETWORK: process.env.UMBRA_NETWORK || "devnet",
    UMBRA_INDEXER_API_ENDPOINT:
        process.env.UMBRA_INDEXER_API_ENDPOINT || "https://utxo-indexer.api.umbraprivacy.com",
    UMBRA_RPC_SUBSCRIPTIONS_URL:
        process.env.UMBRA_RPC_SUBSCRIPTIONS_URL || "",
    UMBRA_PLATFORM_PRIVATE_KEY: process.env.UMBRA_PLATFORM_PRIVATE_KEY || "",
    UMBRA_MINT_ADDRESS:
        process.env.UMBRA_MINT_ADDRESS || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    UMBRA_TREE_INDEX: Number(process.env.UMBRA_TREE_INDEX || "0"),

}
