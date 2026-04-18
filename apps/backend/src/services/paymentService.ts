
export function createPaymentRequest(opts:{
    receiver:string,
    amountLamports:number;
    memo?:string,
    expiresInSec?:number;

}){

    console.log("New payment quote requested...");
    return {
        receiver: opts.receiver,
        amountLamports: opts.amountLamports,
        memo: opts.memo || ""

    }


}