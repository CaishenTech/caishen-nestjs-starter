import { WalletAbstract } from 'crypto/wallets/abstracts';
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
import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class WalletFactory {
  constructor(
    private readonly bitcoinService: BitcoinService,
    private readonly ethereumService: EthereumService,
    private readonly solanaService: SolanaService,
    private readonly suiService: SuiService,
    private readonly aptosService: AptosService,
    private readonly tonService: TonService,
    private readonly nearService: NearService,
    private readonly tronService: TronService,
    private readonly rippleService: RippleService,
    private readonly cardanoService: CardanoService,
    private readonly cosmosService: CosmosService,
  ) {}

  get(chainType: string): WalletAbstract {
    const walletServices: WalletAbstract[] = [
      this.solanaService,
      this.ethereumService,
      this.bitcoinService,
      this.cosmosService,
      this.cardanoService,
      this.tronService,
      this.tonService,
      this.rippleService,
      this.nearService,
      this.aptosService,
      this.suiService,
    ];

    const walletService = walletServices.find(
      (service) => service.chainType === chainType,
    );

    if (!walletService) {
      throw new BadRequestException(`Unsupported chainType ${chainType}`);
    }

    return walletService;
  }
}
