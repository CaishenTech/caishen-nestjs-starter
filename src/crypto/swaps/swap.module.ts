import { Module } from '@nestjs/common';
import { SwapService } from 'crypto/swaps/swap.service';
import { SwapController } from 'crypto/swaps/swap.controller';

@Module({
  controllers: [SwapController],
  providers: [SwapService],
  exports: [SwapService],
})
export class SwapModule {}
