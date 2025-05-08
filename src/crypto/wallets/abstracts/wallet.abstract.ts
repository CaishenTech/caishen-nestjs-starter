import { NotImplementedException } from '@nestjs/common';

import { Hex, SerializedTransactionHex } from 'common/types';
import {
  BuildTransactionDto,
  GetBalanceDto,
  GetWalletDto,
  SendTransactionDto,
  SignAndSendTransactionDto,
} from 'crypto/wallets/dtos';
import { CaishenSDK } from '@caishen/sdk';

export abstract class WalletAbstract {
  /**
   * Init caishen SDK inside child class.
   * @protected
   */
  protected abstract caishenSdk: CaishenSDK;
  /**
   * Specify chain type to use.
   * @protected
   */
  abstract chainType: string;
  /**
   * Specify custom RPC url if needed.
   * @protected
   */
  protected rpc?: string;

  async getWallet(dto?: GetWalletDto) {
    const { account = 1 } = dto || {};
    const wallet = await this.caishenSdk.crypto.getWallet({
      chainType: this.chainType,
      account,
    });

    return wallet;
  }

  async getBalance(dto: GetBalanceDto): Promise<bigint> {
    const { account, tokenAddress, chainId = 1 } = dto;
    const balance = await this.caishenSdk.crypto.getBalance({
      wallet: {
        chainType: this.chainType,
        rpc: this.rpc,
        chainId,
        account,
      },
      payload: {
        token: tokenAddress,
      },
    });

    return BigInt(balance);
  }

  async sendTransaction(dto: SendTransactionDto): Promise<Hex> {
    const { amount, toAddress, tokenAddress, account, memo, chainId = 1 } = dto;

    const transactionHash = await this.caishenSdk.crypto.send({
      wallet: {
        chainType: this.chainType,
        rpc: this.rpc,
        chainId,
        account,
      },
      payload: {
        toAddress,
        token: tokenAddress,
        amount: amount.toString(),
        memo: memo ? +memo : undefined,
      },
    });

    return transactionHash;
  }

  async signAndSendTransaction(dto: SignAndSendTransactionDto): Promise<Hex> {
    if (!this.buildTransaction) {
      throw new NotImplementedException();
    }

    const serializedTransactionHex = await this.buildTransaction!(dto);
    const transactionHash = await this.caishenSdk.crypto.signAndSend({
      wallet: {
        rpc: this.rpc,
        chainType: this.chainType,
        account: dto.account,
      },
      payload: {
        serializedTransaction: serializedTransactionHex,
      },
    });

    return transactionHash;
  }

  /**
   * Constructs any unsigned transaction and serializes it into hex format.
   *
   * @param dto
   */
  buildTransaction?(
    dto: BuildTransactionDto,
  ): Promise<SerializedTransactionHex> {
    throw new NotImplementedException();
  }
}
