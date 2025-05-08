import { BadRequestException, Injectable } from '@nestjs/common';
import { CaishenSDK } from '@caishen/sdk';
import coinSelect, { Utxo } from 'coinselect';
import { crypto, payments, Psbt } from 'bitcoinjs-lib';
import { ECPairAPI, ECPairFactory } from 'ecpair';
import * as tinysecp from 'tiny-secp256k1';
import { v4 } from 'uuid';
import axios from 'axios';
import bs58 from 'bs58';

import { BuildTransactionDto } from 'crypto/wallets/dtos';
import { WalletAbstract } from 'crypto/wallets/abstracts';
import { SerializedTransactionHex } from 'common/types';
import { InjectCaishenSdk } from 'shared/decorators';

interface RawTransaction {
  hex: string;
  vout: {
    n: number;
    scriptPubKey?: { type?: string };
  }[];
}

@Injectable()
export class BitcoinService extends WalletAbstract {
  readonly chainType = 'BITCOIN';

  constructor(
    @InjectCaishenSdk()
    protected readonly caishenSdk: CaishenSDK,
  ) {
    super();
  }

  /**
   * Builds a BITCOIN transaction and serializes it into a hex string.
   *
   * @param dto - Data Transfer Object containing transaction details.
   * @returns Serialized transaction as hex string.
   */
  async buildTransaction(
    dto: BuildTransactionDto,
  ): Promise<SerializedTransactionHex> {
    const ECPair: ECPairAPI = ECPairFactory(tinysecp);

    const { amount, toAddress, account } = dto;
    const { address, publicKey } = await this.getWallet({ account });

    const utxos = await this.getAddressUTXOs(address);
    const feePerByte = await this.estimateSmartFee();

    const targets = [{ address: toAddress, value: Number(amount) }];
    const { inputs, outputs } = coinSelect(utxos, targets, feePerByte);

    if (!inputs?.length || !outputs?.length) {
      throw new BadRequestException('Insufficient funds');
    }

    const psbt = new Psbt();
    const bufPubKey = Buffer.from(bs58.decode(publicKey));
    const keyPair = ECPair.fromPublicKey(bufPubKey);

    for (const input of inputs) {
      const tx = await this.getRawTransaction(input.txId);
      const vout = tx.vout?.find((out) => out.n === input.vout);
      const type = vout?.scriptPubKey?.type || '';

      if (type.includes('witness')) {
        const { output } = payments.p2wpkh({
          pubkey: Buffer.from(bs58.decode(publicKey)),
        });

        if (output) {
          psbt.addInput({
            hash: input.txId,
            index: +input.vout,
            witnessUtxo: {
              script: output,
              value: +input.value,
            },
          });
        }
      } else if (type.includes('taproot')) {
        const xOnlyPubKey = bufPubKey.subarray(1, 33);
        const tweakedChildNode = keyPair.tweak(
          crypto.taggedHash('TapTweak', xOnlyPubKey),
        );
        const internalPubkey = Buffer.from(
          tweakedChildNode.publicKey.subarray(1, 33),
        );
        const { output } = payments.p2tr({
          pubkey: internalPubkey,
        });

        if (output) {
          psbt.addInput({
            hash: input.txId,
            index: +input.vout,
            witnessUtxo: {
              script: output,
              value: +input.value,
            },
            tapInternalKey: xOnlyPubKey,
          });
        }
      } else {
        psbt.addInput({
          hash: input.txId,
          index: +input.vout,
          nonWitnessUtxo: Buffer.from(tx.hex, 'hex'),
        });
      }
    }

    const dustThreshold = 546;

    for (const output of outputs) {
      if (output.value < dustThreshold) {
        throw new BadRequestException('Dust');
      }

      psbt.addOutput({
        address: output.address || address, // if output address is undefined it is a change, then we should specify source address
        value: +output.value,
      });
    }

    return psbt.toHex(); // Serialize Psbt into hex for further signing
  }

  private async getAddressUTXOs(address: string): Promise<Utxo[]> {
    const { data: utxos } = await axios.get<
      {
        txid: string;
        vout: number;
        value: number;
      }[]
    >(`https://blockstream.info/api/address/${address}/utxo`);

    return utxos.map((utxo) => ({
      txId: utxo.txid,
      value: utxo.value,
      vout: utxo.vout,
    }));
  }

  /**
   * Estimate transaction fee per byte using smart fee estimation.
   * @param blocks
   * @private
   */
  private async estimateSmartFee(blocks: number = 6): Promise<number> {
    const result = await this.call<{ feerate: number }>('estimatesmartfee', [
      blocks,
    ]);
    const satPerByte = Math.round((result.feerate * 1e8) / 1000);

    return satPerByte || 3; // Fallback to minimum fee
  }

  /**
   * Fetch raw transaction data for a given txid.
   * @param txId
   * @private
   */
  private async getRawTransaction(txId: string) {
    return this.call<RawTransaction>('getrawtransaction', [txId, true]);
  }

  /**
   * Perform a generic RPC call to Bitcoin node.
   * @param method
   * @param params
   * @private
   */
  private async call<T>(method: string, params: unknown[]): Promise<T> {
    const { data } = await axios.post<{
      result: T;
      id: string;
      error?: any;
    }>('https://docs-demo.btc.quiknode.pro/', {
      jsonrpc: '1.0',
      id: v4(),
      method,
      params,
    });

    if (data.error) {
      throw new BadRequestException(data.error.message);
    }

    return data.result;
  }
}
