declare module 'coinselect' {
  export interface Utxo {
    txId: string;
    vout: number;
    value: number;
    /**
     * For use with PSBT: not needed for coinSelect, but will be passed on to inputs later
     */
    nonWitnessUtxo?: Buffer;
    /**
     * If your utxo is a segwit output, you can use witnessUtxo instead
     */
    witnessUtxo?: {
      script: Buffer;
      /**
       * Is the exact same as the value above
       */
      value: number;
    };
  }

  export interface Target {
    address?: string;
    value?: number;
  }

  export interface CoinSelectResult<T extends Utxo, S extends Target> {
    /**
     * Spendable utxos selected that are going to be part of a new transaction.
     * The coin selector strategy accumulates inputs until the target value (that is output value) (+fees) is reached.
     * Doesn't include dust utxos.
     *
     * Note: dust threshold dissipates 148 * fee rate = full fee per an input (selected utxo)
     */
    inputs?: T[];
    /**
     * Target output (may include a change depending on the situations).
     * In fact, it may contain change if sum of accumulated inputs is higher than sum of outputs values. In this case, we should return a change for a sender's address. So to do this, a change should be included into the outputs array for sender's address.
     *
     * Example: You have utxo of 5 btc, but you want to send only 2 btc, so you your inputs array will contain utxo of 5 btc, and you will have 2 outputs: 2 btc (for receiving address) and 3 btc for your address.
     * Note: Output's array may not contain a change if the resulting change calculated is less than dust threshold value.
     *
     */
    outputs?: S[];
    /**
     * Calculated transaction total fee (in satoshi) based on the utxos provided.
     */
    fee: number;
  }

  /**
   * Blackjack, with Accumulative fallback.
   *
   * @param utxos All actual utxos of the address(-es).
   * @param outputs Target utxos (divided by address).
   * @param feeRate Manual fee rate in satoshi.
   */
  export default function coinSelect<T extends Utxo, S extends Target>(
    utxos: T[],
    outputs: S[],
    feeRate: number,
  ): CoinSelectResult<T, S>;
}

declare module 'coinselect/split' {
  import { CoinSelectResult, Target, Utxo } from 'coinselect';

  /**
   * Splits the input values evenly between all outputs, any provided output with .value remains unchanged
   * @param utxos All actual utxos of the address(-es).
   * @param outputs Target utxos (divided by address).
   * @param feeRate Manual fee rate in satoshi.
   */
  export default function split<T extends Utxo, S extends Target>(
    utxos: T[],
    outputs: S[],
    feeRate: number,
  ): CoinSelectResult<T, S>;
}
