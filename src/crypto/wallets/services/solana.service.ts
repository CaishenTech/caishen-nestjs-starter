import { Injectable } from '@nestjs/common';
import { CaishenSDK } from '@caishen/sdk';

import { WalletAbstract } from 'crypto/wallets/abstracts';
import { BuildTransactionDto } from 'crypto/wallets/dtos';
import { InjectCaishenSdk } from 'shared/decorators';
import { SerializedTransactionHex } from 'common/types';
import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';

@Injectable()
export class SolanaService extends WalletAbstract {
  readonly chainType = 'SOLANA';

  constructor(
    @InjectCaishenSdk()
    protected readonly caishenSdk: CaishenSDK,
  ) {
    super();
  }

  /**
   * Builds a SOLANA or SPL Token transaction and serializes it into a hex string.
   *
   * @param dto - Data Transfer Object containing transaction details.
   * @returns Serialized transaction as hex string.
   */
  async buildTransaction(
    dto: BuildTransactionDto,
  ): Promise<SerializedTransactionHex> {
    const { amount, tokenAddress, toAddress, account } = dto;
    const { publicKey } = await this.getWallet({ account });

    const isNative =
      !tokenAddress ||
      tokenAddress === 'So11111111111111111111111111111111111111111';
    const amountInBaseUnits = BigInt(amount);

    const sender = new PublicKey(publicKey);
    const receiver = new PublicKey(toAddress);

    const transaction = new Transaction();
    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: isNative ? 10000 : 110000,
    });
    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: isNative ? 10000 : 50000,
    });

    transaction.add(modifyComputeUnits);
    transaction.add(addPriorityFee);

    if (isNative) {
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: sender,
          toPubkey: receiver,
          lamports: amountInBaseUnits,
        }),
      );
    } else {
      const mintPub = new PublicKey(tokenAddress);
      const sourceAddress = getAssociatedTokenAddressSync(mintPub, sender);
      const destinationAddress = getAssociatedTokenAddressSync(
        mintPub,
        receiver,
      );

      transaction.add(
        createAssociatedTokenAccountIdempotentInstruction(
          sender,
          sourceAddress,
          sender,
          mintPub,
        ),
      );

      transaction.add(
        createAssociatedTokenAccountIdempotentInstruction(
          sender,
          destinationAddress,
          receiver,
          mintPub,
        ),
      );

      transaction.add(
        createTransferInstruction(
          sourceAddress,
          destinationAddress,
          sender,
          amountInBaseUnits,
        ),
      );
    }

    return transaction
      .serialize({
        requireAllSignatures: false,
        /**
         * No need to verify signatures as they have not been provided yet.
         */
        verifySignatures: false,
      })
      .toString('hex');
  }
}
