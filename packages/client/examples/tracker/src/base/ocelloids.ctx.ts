import { createContext } from '@lit/context';

import { OcelloidsClient } from '../../../..';
export type { OcelloidsClient } from '../../../..';

export const ocelloidsContext = createContext<OcelloidsClient>('ocelloids');
