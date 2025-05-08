import { Body, Controller, Post } from '@nestjs/common';

import { GetRouteDto, ExecuteRouteDto } from 'crypto/swaps/dtos';
import { SwapService } from 'crypto/swaps/swap.service';

@Controller('swap')
export class SwapController {
  constructor(private readonly swapService: SwapService) {}

  @Post('get')
  async getRoute(@Body() body: GetRouteDto) {
    return this.swapService.getRoute(body);
  }

  @Post('execute')
  async executeRoute(body: ExecuteRouteDto) {
    return this.swapService.executeRoute(body);
  }
}
