import { createContext } from '@lit/context';

import { OcelloidsClient } from '../../../../dist/xcmon-client';
export type { OcelloidsClient } from '../../../../dist/xcmon-client';

export const ocelloidsContext = createContext<OcelloidsClient>('ocelloids');
