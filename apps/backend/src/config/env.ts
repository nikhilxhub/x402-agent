import dotenv from "dotenv";
dotenv.config();


export const ENV = {

    SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",

    


}