
export function createPaymentRequest(opts:{
    receiver:string,
    amountLamports:number;
    memo?:string,
    expiresInSec?:number;
    paymentMethod?: "standard" | "umbra";
    currency?: "SOL" | "USDC";
    quoteId?: string;
    umbra?: {
        mint: string;
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
        umbra: opts.umbra || null,

    }


}
