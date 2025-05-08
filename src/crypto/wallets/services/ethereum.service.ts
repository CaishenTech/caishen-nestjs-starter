import { Injectable } from '@nestjs/common';
import { CaishenSDK } from '@caishen/sdk';
import {
  Address,
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  http,
  serializeTransaction,
  TransactionSerializable,
} from 'viem';

import { WalletAbstract } from 'crypto/wallets/abstracts';
import { BuildTransactionDto } from 'crypto/wallets/dtos';
import { InjectCaishenSdk } from 'shared/decorators';
import { SerializedTransactionHex } from 'common/types';
import { mainnet } from 'viem/chains';

@Injectable()
export class EthereumService extends WalletAbstract {
  readonly chainType = 'ETHEREUM';

  constructor(
    @InjectCaishenSdk()
    protected readonly caishenSdk: CaishenSDK,
  ) {
    super();
  }

  /**
   * Builds an ETHEREUM transaction and serializes it into a hex string.
   *
   * @param dto - Data Transfer Object containing transaction details.
   * @returns Serialized transaction as hex string.
   */
  async buildTransaction(
    dto: BuildTransactionDto,
  ): Promise<SerializedTransactionHex> {
    const { amount, tokenAddress, toAddress } = dto;

    const DEFAULT_NATIVE_TRANSFER_GAS = 50_000n;
    const DEFAULT_ERC20_TRANSFER_GAS = 120_000n;

    const isNative =
      !tokenAddress ||
      tokenAddress === '0x0000000000000000000000000000000000000000';
    const url = 'https://docs-demo.quiknode.pro/';

    const publicClient = createPublicClient({
      transport: http(url),
      chain: mainnet,
    });

    const to = (isNative ? toAddress : tokenAddress) as Address;
    const value = isNative ? amount : 0n;

    let data: `0x${string}` = '0x';

    if (!isNative) {
      data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [toAddress as Address, amount],
      });
    }

    const txParams: TransactionSerializable = {
      value,
      data,
      to,
      chainId: publicClient.chain.id,
      gasPrice: await publicClient.getGasPrice(),
      gas: isNative ? DEFAULT_NATIVE_TRANSFER_GAS : DEFAULT_ERC20_TRANSFER_GAS,
    };

    return serializeTransaction(txParams);
  }
}
