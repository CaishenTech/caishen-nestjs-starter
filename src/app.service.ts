import { Injectable } from '@nestjs/common';
import { CaishenSDK } from '@caishen/sdk';
import 'dotenv/config';

@Injectable()
export class AppService {
  async getHello(): Promise<string> {
    const project_key = process.env.PROJECT_KEY
    const user_token = process.env.USER_TOKEN
    const provider = process.env.USER_PROVIDER
    const sdk = new CaishenSDK({ projectKey: project_key });
    const auth_token = await sdk.connectAsUser({
      token: user_token,
      provider: provider,
    });
    console.log("auth token: ", auth_token)

    const chainType = 'ETHEREUM'
    const chainId = 1;
    const account = 0;
    const wallets = await sdk.crypto.getWallet({
      chainType: chainType,
      chainId: chainId,
      account: account,
    });
    console.log("wallets: ", wallets)
    return 'SDK is initiated!';
  }
}
