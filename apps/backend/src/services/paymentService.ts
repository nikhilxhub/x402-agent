export function createPaymentRequest(opts:{
    receiver:string,
    amountLamports:number;
    memo?:string,
    expiresInSec?:number;
    paymentMethod?: "standard" | "umbra";
    currency?: "SOL" | "USDC" | "USDT" | "dUSDC" | "dUSDT";
    quoteId?: string;
    txId?: string;
    umbra?: {
        mint: string;
        symbol: string;
        decimals: number;
        network: string;
        indexerApiEndpoint: string;
        treeIndex: number;
    };

}){

    console.log("New payment quote requested...");
    return {
        receiver: opts.receiver,
        amountLamports: opts.amountLamports,
        memo: opts.memo || "",
        expiresInSec: opts.expiresInSec || 300,
        paymentMethod: opts.paymentMethod || "standard",
        currency: opts.currency || "SOL",
        quoteId: opts.quoteId || null,
        txId: opts.txId || null,
        umbra: opts.umbra || null,

    }


}
