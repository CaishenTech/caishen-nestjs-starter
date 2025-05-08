import { BadRequestException, Injectable } from '@nestjs/common';
import { CaishenSDK } from '@caishen/sdk';
import * as xrpl from 'xrpl';

import { WalletAbstract } from 'crypto/wallets/abstracts';
import { BuildTransactionDto } from 'crypto/wallets/dtos';
import { InjectCaishenSdk } from 'shared/decorators';
import { SerializedTransactionHex } from 'common/types';

@Injectable()
export class RippleService extends WalletAbstract {
  readonly chainType = 'XRP';

  constructor(
    @InjectCaishenSdk()
    protected readonly caishenSdk: CaishenSDK,
  ) {
    super();
  }

  /**
   * Builds and serializes an XRP transaction to hex format.
   *
   * @param dto - Data Transfer Object containing transaction details.
   * @returns Serialized transaction as hex string.
   */
  async buildTransaction(
    dto: BuildTransactionDto,
  ): Promise<SerializedTransactionHex> {
    const { amount, tokenAddress, toAddress, memo, account } = dto;
    const { address: classicAddress } = await this.getWallet({ account });

    const client = new xrpl.Client('wss://s2.ripple.com:443');

    try {
      await client.connect();

      // Ensure the destination account is active (i.e., exists on-chain)
      // XRP accounts must be funded with at least 20 XRP to become active
      try {
        await client.request({
          command: 'account_info',
          account: toAddress,
          ledger_index: 'validated',
        });
      } catch (error) {
        throw new BadRequestException(
          'The account is inactive. It needs at least 20 XRP to be activated.',
        );
      }

      const prepared = await client.autofill({
        TransactionType: 'Payment',
        Account: classicAddress,
        Amount: amount.toString(),
        Destination: toAddress,
        DestinationTag: memo ? +memo : undefined,
      });

      return xrpl.encode(prepared);
    } finally {
      // Ensure clean disconnection from the XRP network
      await client.disconnect();
    }
  }
}
