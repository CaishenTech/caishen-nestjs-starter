import { BadRequestException, Injectable } from '@nestjs/common';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { CaishenSDK } from '@caishen/sdk';

import { WalletAbstract } from 'crypto/wallets/abstracts';
import { BuildTransactionDto } from 'crypto/wallets/dtos';
import { InjectCaishenSdk } from 'shared/decorators';
import { SerializedTransactionHex } from 'common/types';

@Injectable()
export class SuiService extends WalletAbstract {
  readonly chainType = 'SUI';

  constructor(
    @InjectCaishenSdk()
    protected readonly caishenSdk: CaishenSDK,
  ) {
    super();
  }

  /**
   * Builds a SUI transaction and serializes it to hex.
   *
   * @param dto - DTO containing recipient, amount, and optional token address.
   * @returns Serialized transaction in hex string format.
   */
  async buildTransaction(
    dto: BuildTransactionDto,
  ): Promise<SerializedTransactionHex> {
    const { amount, tokenAddress, toAddress, account } = dto;
    const { address } = await this.getWallet({ account });

    const client = new SuiClient({ url: getFullnodeUrl('mainnet') });
    const isNative =
      !tokenAddress ||
      tokenAddress === '0x2::sui::SUI' ||
      tokenAddress ===
        '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI';
    const tx = new Transaction();

    if (isNative) {
      const [coin] = tx.splitCoins(tx.gas, [amount]);

      tx.transferObjects([coin], toAddress);
    } else {
      const coins = await client.getCoins({
        owner: address,
        coinType: tokenAddress,
      });
      const coinObjectIds = coins.data.map((c) => c.coinObjectId);

      if (coinObjectIds.length < 1) {
        throw new BadRequestException('Insufficient funds');
      }

      const [primaryCoin, ...otherCoins] = coinObjectIds;

      if (otherCoins.length > 0) {
        tx.mergeCoins(primaryCoin, otherCoins);
      }

      const [splitCoin] = tx.splitCoins(tx.object(primaryCoin), [
        tx.pure.u64(amount),
      ]);

      tx.transferObjects([splitCoin], tx.pure.address(toAddress));
    }

    const serializedTransactionHex = Buffer.from(
      await tx.toJSON(),
      'utf8',
    ).toString('hex');
    return serializedTransactionHex;
  }
}
