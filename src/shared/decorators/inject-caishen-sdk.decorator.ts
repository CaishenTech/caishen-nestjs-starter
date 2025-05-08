import { Inject } from '@nestjs/common';

import { CAISHEN_SDK_PROVIDER_TOKEN } from '../constants';

export const InjectCaishenSdk = () => Inject(CAISHEN_SDK_PROVIDER_TOKEN);
