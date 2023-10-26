import { NotFound, ValidationError } from '../../errors.js';
import { QuerySubscription } from '../monitoring/types.js';
import { BatchOperation, DB, Family, Logger, jsonEncoded, prefixes } from '../types.js';
import { ServiceConfiguration, isNetworkDefined } from '../config.js';

/**
 * Subscriptions persistence.
 *
 * A subscription is expected to
 * - Have a unique id in the database.
 * - Have a set of unique paths, being each path a combination of
 *   '<origin id>:<destination id>:<sender address>'
 */
export class SubsStore {
  #log: Logger;
  #db: DB;
  #config: ServiceConfiguration;
  #uniques: Family;

  constructor(
    log: Logger,
    db: DB,
    config: ServiceConfiguration
  ) {
    this.#log = log;
    this.#db = db;
    this.#config = config;
    this.#uniques = db.sublevel<string, string>(
      prefixes.subs.uniques, {}
    );
  }

  /**
   * Returns true if a subscription for the given id exists,
   * false otherwise.
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

  /**
   * Retrieves all the subscriptions for a given network.
   *
   * @returns {QuerySubscription[]} an array with the subscriptions
   */
  async getByNetworkId(chainId: string | number) {
    return await this.#subsFamily(chainId.toString()).values().all();
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
        const subscription = await this.#subsFamily(network.id).get(id);
        return subscription;
      } catch (error) {
        continue;
      }
    }

    throw new NotFound(`Subscription ${id} not found.`);
  }

  /**
   * Inserts a new subscription.
   *
   * @throws {ValidationError} if there is a validation error.
   */
  async insert(qs: QuerySubscription) {
    if (await this.exists(qs.id)) {
      throw new ValidationError(`Subscription with ID ${qs.id} already exists`);
    }
    await this.save(qs);
  }

  /**
   * Updates the subscription data.
   *
   * @throws {ValidationError} if there is a validation error.
   */
  async save(qs: QuerySubscription) {
    this.#validateChainIds([
      qs.origin, ...qs.destinations
    ]);
    await this.#validateSubscriptionPaths(qs);

    const db = await this.#subsFamily(qs.origin);
    await db.put(qs.id, qs);
  }

  /**
   * Removes a subscription for the given id.
   */
  async remove(id: string) {
    const qs = await this.getById(id);
    const ops : BatchOperation[] = [];
    this.#getUniquePaths(qs).forEach(key => {
      ops.push({
        type: 'del',
        sublevel: this.#uniques,
        key
      });
    });
    ops.push({
      type: 'del',
      sublevel: this.#subsFamily(qs.origin),
      key: id
    });
    await this.#db.batch(ops);
  }

  /**
   * Removes the unique paths in the database for the
   * difference between the source and modified subscriptions.
   *
   * @param source The original subscription
   * @param modified The modified subscription
   */
  async updateUniquePaths(
    source: QuerySubscription,
    modified: QuerySubscription
  ) {
    const delKeys: string[] = [];

    source.destinations.filter(
      d => modified.destinations.indexOf(d) < 0
    ).forEach(d => {
      for (const s of source.senders) {
        delKeys.push(
          this.#uniquePathKey(source.origin, d, s)
        );
      }
    });
    source.senders.filter(
      s => modified.senders.indexOf(s) < 0
    ).forEach(s => {
      for (const d of source.destinations) {
        delKeys.push(
          this.#uniquePathKey(source.origin, d, s)
        );
      }
    });

    if (delKeys.length > 0) {
      const batch = this.#uniques.batch();
      const newPaths = this.#getUniquePaths(modified);

      delKeys.filter(
        k => newPaths.indexOf(k) < 0
      ).forEach(
        k => {
          batch.del(k);
        }
      );

      await batch.write();
    }
  }

  #uniquePathKey(networkId: number, destination: number, sender: string) {
    return `${networkId}:${destination}:${sender}`;
  }

  #getUniquePaths(qs: QuerySubscription) {
    const paths = [];
    for (const d of qs.destinations) {
      for (const s of qs.senders) {
        paths.push(this.#uniquePathKey(qs.origin, d, s));
      }
    }
    return paths;
  }

  async #validateSubscriptionPaths(qs: QuerySubscription) {
    const batch = this.#uniques.batch();

    let existingKey = false;
    let subId: string;
    let key: string;

    for (const d of qs.destinations) {
      // Senders
      for (const s of qs.senders) {
        key = this.#uniquePathKey(qs.origin, d, s);
        try {
          subId = await this.#uniques.get(key);
          existingKey = subId !== qs.id;
          if (existingKey) {
            break;
          }
        } catch (error) {
          batch.put(key, qs.id);
        }
      }
      // Throw
      if (existingKey) {
        batch.clear();
        batch.close();
        throw new ValidationError(`Path ${key!} already defined in ${subId!}`);
      }
    }

    await batch.write();
  }

  #subsFamily(chainId: string | number) {
    return this.#db.sublevel<string, QuerySubscription>(
      prefixes.subs.family + chainId, jsonEncoded
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
