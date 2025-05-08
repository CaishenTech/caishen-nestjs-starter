import { Injectable } from '@nestjs/common';
import { InjectCaishenSdk } from 'shared/decorators';
import { CaishenSDK } from '@caishen/sdk';

import { ExecuteRouteDto, GetRouteDto } from 'crypto/swaps/dtos';

@Injectable()
export class SwapService {
  constructor(
    @InjectCaishenSdk()
    private readonly caishenSdk: CaishenSDK,
  ) {}

  async getRoute(dto: GetRouteDto): Promise<any> {
    const { account, ...payload } = dto;
    const route = await this.caishenSdk.crypto.getSwapRoute({
      wallet: {
        account,
      },
      payload: payload as any,
    });

    return route; // Should be confirmed within 30 minutes
  }

  async executeRoute(dto: ExecuteRouteDto): Promise<any> {
    const { account, chainType, confirmationCode } = dto;
    const route = await this.caishenSdk.crypto.swap({
      wallet: {
        chainType,
        account,
      },
      payload: {
        confirmationCode,
      },
    });

    return route; // Should be confirmed within 30 minutes
  }
}
