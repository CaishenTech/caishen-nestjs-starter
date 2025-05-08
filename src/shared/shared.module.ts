import { Global, Module, Provider } from '@nestjs/common';
import { CaishenSDK } from '@caishen/sdk';
import env from 'env-var';

import { CAISHEN_SDK_PROVIDER_TOKEN } from './constants';

const caishenProvider: Provider = {
  provide: CAISHEN_SDK_PROVIDER_TOKEN,
  async useFactory(): Promise<CaishenSDK> {
    const userId = env.get('CAISHEN_USER_ID').required().asString();
    const agentId = env.get('CAISHEN_AGENT_ID').required().asString();
    const projectKey = env.get('CAISHEN_PROJECT_KEY').required().asString();

    const sdk = new CaishenSDK({ projectKey });
    await sdk.connectAsAgent({
      userId,
      agentId,
    });

    return sdk;
  },
};

@Global()
@Module({
  providers: [caishenProvider],
  exports: [caishenProvider],
})
export class SharedModule {}
