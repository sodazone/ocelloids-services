import { consume } from '@lit/context';
import { property } from 'lit/decorators.js';

import { OcelloidsClient, ocelloidsContext } from './ocelloids.ctx.js';
import { TwElement } from './tw.lit.js';

export class OcelloidsElement extends TwElement {
  @consume({ context: ocelloidsContext })
  @property({ attribute: false })
  public client?: OcelloidsClient;
}
