import { Injectable } from '@nestjs/common';
import { CaishenSDK } from '@caishen/sdk';

import { WalletAbstract } from 'crypto/wallets/abstracts';
import { BuildTransactionDto } from 'crypto/wallets/dtos';
import { InjectCaishenSdk } from 'shared/decorators';
import { SerializedTransactionHex } from 'common/types';

@Injectable()
export class AptosService extends WalletAbstract {
  readonly chainType = 'APTOS';

  constructor(
    @InjectCaishenSdk()
    protected readonly caishenSdk: CaishenSDK,
  ) {
    super();
  }

  /**
   * Builds a APTOS transaction and serializes it into a hex string.
   *
   * @param dto - Data Transfer Object containing transaction details.
   * @returns Serialized transaction as hex string.
   */
  async buildTransaction(
    dto: BuildTransactionDto,
  ): Promise<SerializedTransactionHex> {
    const { amount, tokenAddress, toAddress, account } = dto;
    const { address } = await this.getWallet({ account });

    const { Aptos, AptosConfig, Network, Serializer } = await import(
      '@aptos-labs/ts-sdk'
    );
    const client = new Aptos(
      new AptosConfig({
        network: Network.MAINNET,
      }),
    );

    const txn = await client.transferCoinTransaction({
      amount: BigInt(amount),
      sender: address,
      recipient: toAddress,
      coinType: tokenAddress as `${string}::${string}::${string}`, // e.g. "0x1::aptos_coin::AptosCoin"
    });

    const serializer = new Serializer();
    txn.serialize(serializer);

    const serializedTransactionHex = Buffer.from(
      serializer.toUint8Array(),
    ).toString('hex');
    return serializedTransactionHex;
  }
}
