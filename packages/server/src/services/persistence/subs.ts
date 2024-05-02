import { NotFound, ValidationError } from '../../errors.js';
import { Subscription } from '../monitoring/types.js';
import { BatchOperation, DB, Logger, jsonEncoded, prefixes, NetworkURN } from '../types.js';
import { IngressConsumer } from '../ingress/index.js';

/**
 * Subscriptions persistence.
 *
 * A subscription is expected to have a unique id in the database.
 */
export class SubsStore {
  // readonly #log: Logger;
  readonly #db: DB;
  readonly #ingress: IngressConsumer;

  constructor(_log: Logger, db: DB, ingress: IngressConsumer) {
    // this.#log = log;
    this.#db = db;
    this.#ingress = ingress;
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
    for (const chainId of this.#ingress.getChainIds()) {
      const subs = await this.getByNetworkId(chainId);
      subscriptions = subscriptions.concat(subs);
    }

    return subscriptions;
  }

  /**
   * Retrieves all the subscriptions for a given network.
   *
   * @returns {Subscription[]} an array with the subscriptions
   */
  async getByNetworkId(chainId: NetworkURN) {
    return await this.#subsFamily(chainId).values().all();
  }

  /**
   * Retrieves a subscription by identifier.
   *
   * @param {string} id The subscription identifier
   * @returns {Subscription} the subscription information
   * @throws {NotFound} if the subscription does not exist
   */
  async getById(id: string) {
    for (const chainId of this.#ingress.getChainIds()) {
      try {
        const subscription = await this.#subsFamily(chainId).get(id);
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
    const origin = qs.origin as NetworkURN;
    const dests = qs.destinations as NetworkURN[];
    this.#validateChainIds([origin, ...dests]);
    const db = await this.#subsFamily(origin);
    await db.put(qs.id, qs);
  }

  /**
   * Removes a subscription for the given id.
   */
  async remove(id: string) {
    const qs = await this.getById(id);
    const origin = qs.origin as NetworkURN;
    const ops: BatchOperation[] = [];
    ops.push({
      type: 'del',
      sublevel: this.#subsFamily(origin),
      key: id,
    });
    await this.#db.batch(ops);
  }

  #subsFamily(chainId: NetworkURN) {
    return this.#db.sublevel<string, Subscription>(prefixes.subs.family(chainId), jsonEncoded);
  }

  #validateChainIds(chainIds: NetworkURN[]) {
    chainIds.forEach((chainId) => {
      if (!this.#ingress.isNetworkDefined(chainId)) {
        throw new ValidationError('Invalid chain id:' + chainId);
      }
    });
  }
}
