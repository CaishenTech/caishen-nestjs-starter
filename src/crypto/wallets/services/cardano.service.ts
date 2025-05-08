import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectCaishenSdk } from 'shared/decorators';
import { CaishenSDK } from '@caishen/sdk';
import * as CardanoWasm from '@emurgo/cardano-serialization-lib-nodejs';
import {
  createConnectionObject,
  createInteractionContext,
  InteractionContext,
  LedgerStateQuery,
} from '@cardano-ogmios/client';
import coinSelection = require('@fivebinaries/coin-selection');

import { BuildTransactionDto } from 'crypto/wallets/dtos';
import { SerializedTransactionHex } from 'common/types';
import { WalletAbstract } from 'crypto/wallets/abstracts';

@Injectable()
export class CardanoService extends WalletAbstract {
  readonly chainType = 'CARDANO';

  constructor(
    @InjectCaishenSdk()
    protected readonly caishenSdk: CaishenSDK,
  ) {
    super();
  }

  /**
   * Builds a CARDANO transaction and serializes it into a hex string.
   *
   * @param dto - Data Transfer Object containing transaction details.
   * @returns Serialized transaction as hex string.
   */
  async buildTransaction(
    dto: BuildTransactionDto,
  ): Promise<SerializedTransactionHex> {
    const { amount, tokenAddress, toAddress, account } = dto;
    const { address } = await this.getWallet({ account });

    const interactionContext = await this.createOgmiosContext();
    const utxos = await this.getAddressUTXOs(address, interactionContext);

    // amount in base units
    const quantityInput = BigInt(amount).toString();
    const protocolParams = await this.getProtocolParams(interactionContext);

    const txPlan = coinSelection.coinSelection(
      {
        utxos,
        outputs: [
          {
            address: toAddress,
            setMax: false,
            assets: tokenAddress // if is not native transfer
              ? [
                  {
                    quantity: quantityInput,
                    unit: tokenAddress,
                  },
                ]
              : [],
            amount: tokenAddress // if is not native transfer
              ? '0' // coinSelection will choose the minimum amount by itself
              : quantityInput,
          },
        ],
        changeAddress: address,
        certificates: [],
        withdrawals: [],
        accountPubKey: '',
      },
      {
        debug: false,
        feeParams: {
          a: (tokenAddress
            ? protocolParams.minFeeA + 6
            : protocolParams.minFeeA + 1
          ).toString(),
        },
      },
    );

    if (
      !('inputs' in txPlan && txPlan.inputs.length) ||
      !('outputs' in txPlan && txPlan.outputs.length)
    ) {
      throw new BadRequestException('Insufficient funds');
    }

    const txBuilder = this.initTxBuilder(protocolParams, txPlan.fee);

    for (const input of txPlan.inputs) {
      const txInput = CardanoWasm.TransactionInput.new(
        CardanoWasm.TransactionHash.from_bytes(
          Buffer.from(input.txHash, 'hex'),
        ),
        input.outputIndex,
      );

      for (const amount of input.amount) {
        const inputValue = this.createCardanoValue(amount, input.amount);

        txBuilder.add_regular_input(
          CardanoWasm.Address.from_bech32(input.address),
          txInput,
          inputValue,
        );
      }
    }

    for (const output of txPlan.outputs) {
      const outputValue = CardanoWasm.Value.new(
        CardanoWasm.BigNum.from_str(output.amount),
      );
      const addressOutput = CardanoWasm.Address.from_bech32(output.address);

      let txOutputAmountBuilder = CardanoWasm.TransactionOutputBuilder.new()
        .with_address(addressOutput)
        .next()
        .with_value(outputValue);

      if (output.assets.length) {
        for (const asset of output.assets) {
          const assets = CardanoWasm.Assets.new();
          const multiAsset = CardanoWasm.MultiAsset.new();

          const policyId = asset.unit.slice(0, 56);
          const assetName = asset.unit.slice(56, asset.unit.length);

          assets.insert(
            CardanoWasm.AssetName.new(Buffer.from(assetName, 'hex')),
            CardanoWasm.BigNum.from_str(asset.quantity),
          );
          multiAsset.insert(
            CardanoWasm.ScriptHash.from_bytes(Buffer.from(policyId, 'hex')),
            assets,
          );
          txOutputAmountBuilder = txOutputAmountBuilder.with_coin_and_asset(
            CardanoWasm.BigNum.from_str(output.amount),
            multiAsset,
          );
        }
      }

      txBuilder.add_output(txOutputAmountBuilder.build());
    }

    txBuilder.add_change_if_needed(CardanoWasm.Address.from_bech32(address));

    const txBody = txBuilder.build();
    return txBody.to_hex();
  }

  /**
   * Creates Ogmios interaction context for blockchain state access.
   * @private
   */
  private createOgmiosContext(): Promise<InteractionContext> {
    return createInteractionContext(
      () => 0,
      () => 0,
      {
        connection: createConnectionObject({
          address: {
            http: 'https://go.getblock.io/1e8ddc3fd2d249f2b3f2fcf550e99bb3',
            webSocket: 'wss://go.getblock.io/68afeff066af41bb89baed64b21671b8',
          },
        }),
      },
    );
  }

  /**
   * Initializes the transaction builder with protocol parameters.
   * @param protocolParams
   * @param fee
   * @private
   */
  private initTxBuilder(
    protocolParams: Awaited<ReturnType<CardanoService['getProtocolParams']>>,
    fee: string,
  ): CardanoWasm.TransactionBuilder {
    const coinsPerUtxoByte = CardanoWasm.BigNum.from_str(
      protocolParams.coinsPerUtxoByte,
    );
    const linearFee = CardanoWasm.LinearFee.new(
      CardanoWasm.BigNum.from_str('0'),
      CardanoWasm.BigNum.from_str(fee),
    );

    return CardanoWasm.TransactionBuilder.new(
      CardanoWasm.TransactionBuilderConfigBuilder.new()
        .fee_algo(linearFee)
        .pool_deposit(CardanoWasm.BigNum.from_str(protocolParams.poolDeposit))
        .key_deposit(CardanoWasm.BigNum.from_str(protocolParams.keyDeposit))
        .max_value_size(protocolParams.maxValueSize)
        .max_tx_size(protocolParams.maxTxSize)
        .coins_per_utxo_byte(coinsPerUtxoByte)
        .build(),
    );
  }

  private async getProtocolParams(interactionContext: InteractionContext) {
    const protocolParams =
      await LedgerStateQuery.protocolParameters(interactionContext);

    return {
      minFeeA: protocolParams.minFeeCoefficient,
      minFeeB: +protocolParams.minFeeConstant.ada.lovelace.toString(),
      keyDeposit: protocolParams.stakeCredentialDeposit.ada.lovelace.toString(),
      poolDeposit:
        protocolParams.stakeCredentialDeposit.ada.lovelace.toString(),
      coinsPerUtxoByte: parseInt(
        protocolParams.minUtxoDepositCoefficient.toString(),
      ).toString(),
      maxTxSize: parseInt(protocolParams.maxTransactionSize!.bytes.toString()),
      maxValueSize: parseInt(protocolParams.maxValueSize!.bytes.toString()),
    };
  }

  private async getAddressUTXOs(
    address: string,
    interactionContext,
  ): Promise<coinSelection.types.Utxo[]> {
    const utxos = await LedgerStateQuery.utxo(interactionContext, {
      addresses: [address],
    });

    return utxos.map((utxo) => ({
      address: utxo.address,
      txHash: utxo.transaction.id,
      outputIndex: utxo.index,
      amount: Object.values(utxo.value)
        .flatMap((o) => Object.entries(o))
        .map(([unit, quantity]) => ({
          unit,
          quantity: quantity.toString(),
        })),
    }));
  }

  /**
   * Converts a UTXO amount entry to CardanoWasm.Value,
   * including native assets if applicable.
   *
   * @param amount
   * @param fullAmounts
   * @private
   */
  private createCardanoValue(
    amount: coinSelection.types.Asset,
    fullAmounts: coinSelection.types.Asset[],
  ): CardanoWasm.Value {
    const quantity = CardanoWasm.BigNum.from_str(amount.quantity);

    if (amount.unit !== 'lovelace') {
      const multiAsset = this.createMultiAsset(fullAmounts);
      const lovelaceAmount = fullAmounts.find(
        (a) => a.unit === 'lovelace',
      )!.quantity;
      return CardanoWasm.Value.new_with_assets(
        CardanoWasm.BigNum.from_str(lovelaceAmount),
        multiAsset,
      );
    }

    return CardanoWasm.Value.new(quantity);
  }

  /**
   * Creates MultiAsset from an array of assets.
   * @param assetsArray
   * @private
   */
  private createMultiAsset(
    assetsArray: coinSelection.types.Asset[],
  ): CardanoWasm.MultiAsset {
    const multiAsset = CardanoWasm.MultiAsset.new();

    for (const asset of assetsArray.filter((a) => a.unit !== 'lovelace')) {
      const policyId = asset.unit.slice(0, 56);
      const assetName = asset.unit.slice(56);

      const assets = CardanoWasm.Assets.new();
      assets.insert(
        CardanoWasm.AssetName.new(Buffer.from(assetName, 'hex')),
        CardanoWasm.BigNum.from_str(asset.quantity),
      );

      multiAsset.insert(
        CardanoWasm.ScriptHash.from_bytes(Buffer.from(policyId, 'hex')),
        assets,
      );
    }

    return multiAsset;
  }
}
