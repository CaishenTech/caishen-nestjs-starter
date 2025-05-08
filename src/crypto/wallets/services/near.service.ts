import { Injectable } from '@nestjs/common';
import { CaishenSDK } from '@caishen/sdk';
import * as nearAPI from 'near-api-js';

import { WalletAbstract } from 'crypto/wallets/abstracts';
import { BuildTransactionDto, GetWalletDto } from 'crypto/wallets/dtos';
import { InjectCaishenSdk } from 'shared/decorators';
import { SerializedTransactionHex } from 'common/types';

@Injectable()
export class NearService extends WalletAbstract {
  readonly chainType = 'NEAR';

  constructor(
    @InjectCaishenSdk()
    protected readonly caishenSdk: CaishenSDK,
  ) {
    super();
  }

  /**
   * Builds a NEAR transaction and serializes it into a hex string.
   *
   * @param dto - Data Transfer Object containing transaction details.
   * @returns Serialized transaction as hex string.
   */
  async buildTransaction(
    dto: BuildTransactionDto,
  ): Promise<SerializedTransactionHex> {
    const { amount, toAddress, account: accountNumber } = dto;
    const { publicKey } = await this.getWallet({ account: accountNumber });

    // Convert public key to account ID format for NEAR
    // see https://docs.near.org/integrations/implicit-accounts#background
    const accountId = Buffer.from(
      nearAPI.utils.PublicKey.fromString(publicKey).data,
    ).toString('hex');

    const near = await nearAPI.connect({
      networkId: 'mainnet',
      keyStore: new nearAPI.keyStores.InMemoryKeyStore(),
      nodeUrl: 'https://rpc.mainnet.near.org/',
    });
    const account = await near.account(accountId);

    const actions = [nearAPI.transactions.transfer(amount)];
    const accessKey = await account.findAccessKey(toAddress, actions);

    const recentBlockHash = nearAPI.utils.serialize.base_decode(
      accessKey.accessKey.block_hash,
    );

    const tx = nearAPI.transactions.createTransaction(
      accountId,
      nearAPI.utils.PublicKey.fromString(publicKey),
      toAddress,
      accessKey.accessKey.nonce, // nonce for transaction ordering
      actions,
      recentBlockHash,
    );

    // Serialize the transaction to binary, then convert to hex
    const serializedTransaction = Buffer.from(tx.encode()).toString('hex');
    return serializedTransaction;
  }
}
