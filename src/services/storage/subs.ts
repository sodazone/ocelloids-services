import { NotFound, ValidationError } from '../../errors.js';
import { QuerySubscription } from '../monitoring/types.js';
import { DB, Logger } from '../types.js';
import { ServiceConfiguration, isNetworkDefined } from '../configuration.js';

export class SubsDB {
  #log: Logger;
  #db: DB;
  #config: ServiceConfiguration;

  constructor(
    log: Logger,
    db: DB,
    config: ServiceConfiguration
  ) {
    this.#log = log;
    this.#db = db;
    this.#config = config;
  }

  /**
   *
   */
  async exists(id: string) : Promise<boolean> {
    try {
      await this.getById(id);
      return true;
    } catch {
      return  false;
    }
  }

  /**
   * Retrieves the registered subscriptions in the database
   * for all the configured networks.
   *
   * @returns {QuerySubscription[]} an array with the subscriptions
   */
  async getAll() {
    let subscriptions: QuerySubscription[] = [];
    for (const network of this.#config.networks) {
      const subs = await this.getByNetworkId(network.id);
      subscriptions = subscriptions.concat(subs);
    }

    return subscriptions;
  }

  async getByNetworkId(chainId: string | number) {
    return await this.#slqs(chainId.toString()).values().all();
  }

  /**
   * Retrieves a subscription by identifier.
   *
   * @param {string} id The subscription identifier
   * @returns {QuerySubscription} the subscription information
   * @throws {NotFound} if the subscription does not exist
   */
  async getById(id: string) {
    // TODO: case if network config changes...
    for (const network of this.#config.networks) {
      try {
        const subscription = await this.#slqs(network.id).get(id);
        return subscription;
      } catch (error) {
        continue;
      }
    }

    throw new NotFound(`Subscription ${id} not found.`);
  }

  async insert(qs: QuerySubscription) {
    if (await this.exists(qs.id)) {
      throw new ValidationError(`Subscription with ID ${qs.id} already exists`);
    }
    await this.save(qs);
  }

  /**
   * Updates the subscription data in the database.
   */
  async save(qs: QuerySubscription) {
    this.#validateChainIds([
      qs.origin, ...qs.destinations
    ]);
    await this.#validateSubscriptionPaths(qs);

    const db = await this.#slqs(qs.origin);
    await db.put(qs.id, qs);
  }

  async remove(chainId: number, id: string) {
    // TODO delete unique paths
    await this.#slqs(chainId).del(id);
  }

  async #validateSubscriptionPaths(qs: QuerySubscription) {
    const uniques = this.#db.sublevel<string, string>('ukeys', {});
    const batch = uniques.batch();
    let existingKey = false;
    let subId: string;
    let ukey: string;
    for (const d of qs.destinations) {
      // Senders
      for (const s of qs.senders) {
        ukey = `${qs.origin}:${d}:${s}`;
        try {
          subId = await uniques.get(ukey);
          existingKey = subId !== qs.id;
          if (existingKey) {
            break;
          }
        } catch (error) {
          batch.put(ukey, qs.id);
        }
      }
      // Throw
      if (existingKey) {
        batch.clear();
        batch.close();
        throw new ValidationError(`Path ${ukey!} already defined in ${subId!}`);
      }
    }

    await batch.write();
  }

  #slqs(chainId: string | number) {
    return this.#db.sublevel<string, QuerySubscription>(
      chainId + ':subs', { valueEncoding: 'json'}
    );
  }

  #validateChainIds(chainIds: number[]) {
    chainIds.forEach(chainId => {
      if (!isNetworkDefined(this.#config, chainId)) {
        throw new ValidationError('Invalid chain id:' +  chainId);
      }
    });
  }
}
