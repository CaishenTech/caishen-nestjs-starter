import { Module } from '@nestjs/common';

import { SharedModule } from 'shared';
import { WalletsModule } from 'crypto/wallets';
import { SwapModule } from 'crypto/swaps/swap.module';

@Module({
  imports: [SharedModule, WalletsModule, SwapModule],
})
export class AppModule {}
