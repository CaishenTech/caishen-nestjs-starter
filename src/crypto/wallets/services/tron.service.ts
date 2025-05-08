import { Injectable } from '@nestjs/common';
import { InjectCaishenSdk } from 'shared/decorators';
import { CaishenSDK } from '@caishen/sdk';

import { BuildTransactionDto } from 'crypto/wallets/dtos';
import { SerializedTransactionHex } from 'common/types';
import { WalletAbstract } from 'crypto/wallets/abstracts';
import { TronWeb } from 'tronweb';
import {
  Transaction,
  TransferContract,
  TriggerSmartContract,
} from 'tronweb/lib/commonjs/types';

const { TronWeb: TronWebConstructor } = require('tronweb');

@Injectable()
export class TronService extends WalletAbstract {
  readonly chainType = 'TRON';

  constructor(
    @InjectCaishenSdk()
    protected readonly caishenSdk: CaishenSDK,
  ) {
    super();
  }

  /**
   * Builds a TRON transaction and serializes it into a hex string.
   *
   * @param dto - Data Transfer Object containing transaction details.
   * @returns Serialized transaction as hex string.
   */
  async buildTransaction(
    dto: BuildTransactionDto,
  ): Promise<SerializedTransactionHex> {
    const { amount, tokenAddress, toAddress, account } = dto;
    const tronWeb: TronWeb = new TronWebConstructor({
      fullhost: 'https://api.trongrid.io',
    });
    const { address } = await this.getWallet({ account });

    let transaction: Transaction<TransferContract | TriggerSmartContract>;

    if (tokenAddress) {
      let energyPrice = 420n;

      try {
        const chainParameters = await tronWeb.trx.getChainParameters();
        const getEnergyFee = chainParameters.find(
          (parameter) => parameter.key === 'getEnergyFee',
        );

        energyPrice = getEnergyFee?.value
          ? BigInt(getEnergyFee.value)
          : energyPrice;
      } catch {
        energyPrice = 420n;
      }

      const { energy_used = 1 } =
        await tronWeb.transactionBuilder.triggerConstantContract(
          tokenAddress,
          'transfer(address,uint256)',
          {},
          [
            {
              type: 'address',
              value: toAddress,
            },
            {
              type: 'uint256',
              value: amount.toString(),
            },
          ],
          address,
        );

      const trc20TransferEnergyConsumption = BigInt(energy_used);
      const accountFreeBandwidth = await tronWeb.trx.getBandwidth(address);
      const bandwidthFee = accountFreeBandwidth < 345 ? 724_500n : 0n;
      const feeLimit =
        trc20TransferEnergyConsumption * energyPrice + bandwidthFee;

      const transactionWrapper =
        await tronWeb.transactionBuilder.triggerSmartContract(
          tokenAddress,
          'transfer(address,uint256)',
          {
            feeLimit: parseInt(feeLimit.toString()),
          },
          [
            {
              type: 'address',
              value: toAddress,
            },
            {
              type: 'uint256',
              value: amount.toString(),
            },
          ],
          address,
        );

      transaction = transactionWrapper.transaction;
    } else {
      transaction = await tronWeb.transactionBuilder.sendTrx(
        toAddress,
        parseInt(amount.toString()),
        address,
      );
    }

    const serializedTransaction = Buffer.from(
      JSON.stringify(transaction),
      'utf8',
    ).toString('hex');

    return serializedTransaction;
  }
}
