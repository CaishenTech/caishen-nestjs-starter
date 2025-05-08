export interface GetRouteDto {
  account: number;
  amount: string;
  from: {
    chainId: number;
    chainType: string;
    tokenAddress: string;
  };
  to: {
    chainId: number;
    chainType: string;
    tokenAddress: string;
  };
}

export interface ExecuteRouteDto {
  account: number;
  chainType: string;
  confirmationCode: string;
}
