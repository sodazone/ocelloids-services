import { NotFound, ValidationError } from '../../errors.js';
import { Subscription } from '../monitoring/types.js';
import { BatchOperation, DB, Logger, jsonEncoded, prefixes } from '../types.js';
import { ServiceConfiguration, isNetworkDefined } from '../config.js';

/**
 * Subscriptions persistence.
 *
 * A subscription is expected to have a unique id in the database.
 */
export class SubsStore {
  readonly #log: Logger;
  readonly #db: DB;
  readonly #config: ServiceConfiguration;

  constructor(log: Logger, db: DB, config: ServiceConfiguration) {
    this.#log = log;
    this.#db = db;
    this.#config = config;
  }

  /**
   * Returns true if a subscription for the given id exists,
   * false otherwise.
   */
  async exists(id: string): Promise<boolean> {
    try {
      await this.getById(id);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retrieves the registered subscriptions in the database
   * for all the configured networks.
   *
   * @returns {Subscription[]} an array with the subscriptions
   */
  async getAll() {
    let subscriptions: Subscription[] = [];
    for (const network of this.#config.networks) {
      const subs = await this.getByNetworkId(network.id);
      subscriptions = subscriptions.concat(subs);
    }

    return subscriptions;
  }

  /**
   * Retrieves all the subscriptions for a given network.
   *
   * @returns {Subscription[]} an array with the subscriptions
   */
  async getByNetworkId(chainId: string | number) {
    return await this.#subsFamily(chainId.toString()).values().all();
  }

  /**
   * Retrieves a subscription by identifier.
   *
   * @param {string} id The subscription identifier
   * @returns {Subscription} the subscription information
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
  async insert(qs: Subscription) {
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
  async save(qs: Subscription) {
    this.#validateChainIds([qs.origin, ...qs.destinations]);
    const db = await this.#subsFamily(qs.origin);
    await db.put(qs.id, qs);
  }

  /**
   * Removes a subscription for the given id.
   */
  async remove(id: string) {
    const qs = await this.getById(id);
    const ops: BatchOperation[] = [];
    ops.push({
      type: 'del',
      sublevel: this.#subsFamily(qs.origin),
      key: id,
    });
    await this.#db.batch(ops);
  }

  #subsFamily(chainId: string) {
    return this.#db.sublevel<string, Subscription>(prefixes.subs.family(chainId), jsonEncoded);
  }

  #validateChainIds(chainIds: string[]) {
    chainIds.forEach((chainId) => {
      if (!isNetworkDefined(this.#config, chainId)) {
        throw new ValidationError('Invalid chain id:' + chainId);
      }
    });
  }
}
