import { Injectable } from '@nestjs/common';
import { InjectCaishenSdk } from 'shared/decorators';
import { CaishenSDK } from '@caishen/sdk';
import {
  Address,
  beginCell,
  Builder,
  internal,
  JettonMaster,
  JettonWallet,
  MessageRelaxed,
  SendMode,
  storeOutList,
  toNano,
  TonClient,
  WalletContractV5R1,
} from '@ton/ton';

import { BuildTransactionDto } from 'crypto/wallets/dtos';
import { SerializedTransactionHex } from 'common/types';
import { WalletAbstract } from 'crypto/wallets/abstracts';

@Injectable()
export class TonService extends WalletAbstract {
  readonly chainType = 'TON';

  constructor(
    @InjectCaishenSdk()
    protected readonly caishenSdk: CaishenSDK,
  ) {
    super();
  }

  /**
   * Builds a TON or Jetton transaction and serializes it to hex.
   *
   * @param dto - DTO containing recipient, amount, and optional token address.
   * @returns Serialized transaction in hex string format.
   */
  async buildTransaction(
    dto: BuildTransactionDto,
  ): Promise<SerializedTransactionHex> {
    const { amount, tokenAddress, toAddress, account } = dto;

    const client = new TonClient({
      endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    });

    const { publicKey } = await this.getWallet({ account });
    // Create TON wallet V5R1 contract instance from public key
    const wallet = WalletContractV5R1.create({
      publicKey: Buffer.from(publicKey, 'hex'),
    });
    const contract = client.open(wallet);
    const seqno = await contract.getSeqno();

    // If no tokenAddress is provided, this is a native TON transfer
    let transferMessage: MessageRelaxed = internal({
      value: BigInt(amount), // https://github.com/ton-org/ton-core/blob/0.60.1/src/types/_helpers.ts#L45
      to: toAddress,
      bounce: false,
    });

    if (tokenAddress) {
      const jettonUserWalletAddress = await client
        .open(JettonMaster.create(Address.parse(tokenAddress)))
        .getWalletAddress(wallet.address);

      const jettonWallet = client.open(
        JettonWallet.create(jettonUserWalletAddress),
      );

      // Forward payload - user-defined message (optional)
      const forwardPayload = beginCell()
        .storeUint(0, 32) // 0 opcode means we have a comment
        .storeStringTail('Jetton Transfer')
        .endCell();

      const messageBody = beginCell()
        .storeUint(0x0f8a7ea5, 32) // opcode for jetton transfer
        .storeUint(0, 64) // query id
        .storeCoins(BigInt(amount)) // jetton amount, amount * 10^9
        .storeAddress(Address.parse(toAddress))
        .storeAddress(wallet.address) // response destination
        .storeBit(0) // no custom payload
        .storeCoins(0) // forward amount - if >0, will send notification message
        .storeBit(1) // we store forwardPayload as a reference
        .storeRef(forwardPayload)
        .endCell();

      transferMessage = internal({
        to: jettonWallet.address,
        value: toNano('0.05'),
        bounce: true,
        body: messageBody,
      });
    }

    // Build unsigned external message
    const unsignedMessage = beginCell()
      .storeUint(WalletContractV5R1.OpCodes.auth_signed_external, 32)
      .store((builder: Builder) => {
        // Derive context for signing
        let context: number;

        if (typeof wallet.walletId.context !== 'number') {
          context = beginCell()
            .storeUint(1, 1)
            .storeInt(wallet.walletId.context.workchain, 8)
            .storeUint(0, 8)
            .storeUint(wallet.walletId.context.subwalletNumber, 15)
            .endCell()
            .beginParse()
            .loadInt(32);
        } else {
          context = beginCell()
            .storeUint(0, 1)
            .storeUint(wallet.walletId.context, 31)
            .endCell()
            .beginParse()
            .loadInt(32);
        }

        return builder.storeInt(
          BigInt(wallet.walletId.networkGlobalId) ^ BigInt(context),
          32,
        );
      });

    // Add timestamp or magic bits
    if (seqno === 0) {
      // For new wallet, append 32 bits of ones
      for (let i = 0; i < 32; i++) {
        unsignedMessage.storeBit(1);
      }
    } else {
      unsignedMessage.storeUint(Math.floor(Date.now() / 1e3) + 60, 32); // 60 seconds timeout
    }

    // Append sequence number and outgoing message
    unsignedMessage.storeUint(seqno, 32).store((builder: Builder) => {
      const outListPacked = beginCell().store(
        storeOutList([
          {
            type: 'sendMsg',
            // https://docs.ton.org/v3/documentation/smart-contracts/func/docs/stdlib#actions-primitives
            mode: SendMode.NONE + SendMode.IGNORE_ERRORS,
            outMsg: transferMessage,
          },
        ]),
      );

      builder.storeMaybeRef(outListPacked); // Outgoing transfer
      builder.storeUint(0, 1); // No state init
    });

    const serializedTransaction = Buffer.from(
      unsignedMessage.endCell().toBoc(),
    ).toString('hex');

    return serializedTransaction;
  }
}
