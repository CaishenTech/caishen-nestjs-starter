import { Injectable } from '@nestjs/common';
import { InjectCaishenSdk } from 'shared/decorators';
import { CaishenSDK } from '@caishen/sdk';
import { TxBody, TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx';
import { Any } from 'cosmjs-types/google/protobuf/any';
import { toHex } from '@cosmjs/encoding';
import { Int53 } from '@cosmjs/math';

import { BuildTransactionDto } from 'crypto/wallets/dtos';
import { SerializedTransactionHex } from 'common/types';
import { WalletAbstract } from 'crypto/wallets/abstracts';
import { calculateFee, GasPrice, StargateClient } from '@cosmjs/stargate';
import { makeAuthInfoBytes } from '@cosmjs/proto-signing';
import { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin';

@Injectable()
export class CosmosService extends WalletAbstract {
  readonly chainType = 'COSMOS';

  constructor(
    @InjectCaishenSdk()
    protected readonly caishenSdk: CaishenSDK,
  ) {
    super();
  }

  /**
   * Builds a COSMOS transaction and serializes it into a hex string.
   *
   * @param dto - Data Transfer Object containing transaction details.
   * @returns Serialized transaction as hex string.
   */
  async buildTransaction(
    dto: BuildTransactionDto,
  ): Promise<SerializedTransactionHex> {
    const { amount, tokenAddress, toAddress, memo, account } = dto;
    const { address, publicKey } = await this.getWallet({ account });

    const transactionDenom = tokenAddress || 'uatom';
    const client = await StargateClient.connect(
      'https://cosmos-rpc.publicnode.com:443',
    );

    const accountOnChain = await client.getAccount(address);

    if (!accountOnChain) throw new Error('Account not found on chain');

    const coin = Coin.fromPartial({
      denom: transactionDenom,
      amount: amount.toString(),
    });
    const msgSend = MsgSend.fromPartial({
      fromAddress: address,
      toAddress,
      amount: [coin],
    });
    const msgSendBytes = MsgSend.encode(msgSend).finish();
    const msgSendWrapped = Any.fromPartial({
      typeUrl: '/cosmos.bank.v1beta1.MsgSend',
      value: msgSendBytes,
    });
    const txBody = TxBody.fromPartial({
      messages: [msgSendWrapped],
      extensionOptions: [],
      memo: memo?.toString(),
    });
    const txBodyBytes = TxBody.encode(txBody).finish();

    const estimatedGas = 150_000; // You can make this dynamic if needed
    const gasPrice = GasPrice.fromString('0.025uatom');
    const fee = calculateFee(estimatedGas, gasPrice);

    const authInfoBytes = makeAuthInfoBytes(
      [
        {
          pubkey: {
            typeUrl: '/cosmos.crypto.secp256k1.PubKey',
            value: Buffer.from(publicKey, 'hex'),
          },
          sequence: accountOnChain.sequence,
        },
      ],
      fee.amount,
      Int53.fromString(fee.gas).toNumber(),
      fee.granter,
      fee.payer,
    );

    const txRaw = TxRaw.fromPartial({
      authInfoBytes,
      bodyBytes: txBodyBytes,
    });

    const txRawBytes = Uint8Array.from(TxRaw.encode(txRaw).finish());
    const txBytesHex = toHex(txRawBytes);

    return txBytesHex;
  }
}
