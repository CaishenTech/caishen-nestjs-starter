import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { WalletFactory } from 'crypto/wallets/wallet.factory';
import {
  GetBalanceDto,
  GetWalletDto,
  SendTransactionDto,
} from 'crypto/wallets/dtos';

@Controller('wallet/:chainType')
export class WalletController {
  constructor(private readonly walletFactory: WalletFactory) {}

  @Get()
  async getWallet(
    @Param('chainType') chainType: string,
    @Query() query: GetWalletDto,
  ) {
    return this.walletFactory.get(chainType.toUpperCase()).getWallet(query);
  }

  @Get('balance')
  async getBalance(
    @Param('chainType') chainType: string,
    @Query() query: GetBalanceDto,
  ) {
    return this.walletFactory.get(chainType.toUpperCase()).getBalance(query);
  }

  @Post('send')
  async sendTransaction(
    @Param('chainType') chainType: string,
    @Body() body: SendTransactionDto,
  ) {
    return this.walletFactory.get(chainType.toUpperCase()).sendTransaction({
      ...body,
      amount: BigInt(body.amount),
    });

    // or
    // return this.walletFactory
    //   .get(chainType)
    //   .signAndSendTransaction({
    //     ...body,
    //     amount: BigInt(body.amount),
    //   });
  }
}
