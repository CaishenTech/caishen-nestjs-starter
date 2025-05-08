import { Module, Provider } from '@nestjs/common';

import {
  AptosService,
  BitcoinService,
  CardanoService,
  CosmosService,
  EthereumService,
  NearService,
  RippleService,
  SolanaService,
  SuiService,
  TonService,
  TronService,
} from 'crypto/wallets/services';
import { WalletController } from 'crypto/wallets/wallet.controller';
import { WalletFactory } from 'crypto/wallets/wallet.factory';

const providers: Provider[] = [
  BitcoinService,
  CardanoService,
  CosmosService,
  TronService,
  TonService,
  SolanaService,
  SuiService,
  EthereumService,
  AptosService,
  WalletFactory,
  NearService,
  RippleService,
];

@Module({
  controllers: [WalletController],
  providers: [...providers],
  exports: [...providers],
})
export class WalletsModule {}
