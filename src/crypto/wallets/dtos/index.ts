export interface GetWalletDto {
  account: number;
}

export interface GetBalanceDto extends GetWalletDto {
  chainId?: number;
  tokenAddress?: string;
}

export interface SendTransactionDto extends GetWalletDto {
  amount: bigint;
  tokenAddress?: string;
  toAddress: string;
  memo?: string | number;
  chainId?: number; // matters for evm only
}

export interface BuildTransactionDto extends SendTransactionDto {}
export interface SignAndSendTransactionDto extends SendTransactionDto {}
