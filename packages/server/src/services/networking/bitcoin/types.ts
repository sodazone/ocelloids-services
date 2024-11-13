export type ChainInfo = {
  chain: string // current network name (main, test, regtest)
  blocks: number // (the height of the most-work fully-validated chain. The genesis block has height 0
  headers: number //the current number of headers we have validated
  bestblockhash: string //the hash of the currently best block
  difficulty: number //the current difficulty
  mediantime: number //median time for the current best block
  verificationprogress: number //estimate of verification progress [0..1]
  initialblockdownload: boolean //(debug information) estimate of whether this node is in Initial Block Download mode
  chainwork: string // total amount of work in active chain, in hexadecimal
  size_on_disk: number // the estimated size of the block and undo files on disk
  pruned: boolean //if the blocks are subject to pruning
  pruneheight: number //lowest-height complete block stored (only present if pruning is enabled)
  automatic_pruning: boolean //whether automatic pruning is enabled (only present if pruning is enabled)
  prune_target_size: number //the target size used by pruning (only present if automatic pruning is enabled)
  softforks: SoftFork
  warnings: string
}

export type SoftFork = Record<
  string,
  {
    type: 'buried' | 'bip9'
    bip9?: {
      status: 'defined' | 'started' | 'locked_in' | 'active' | 'failed'
      bit?: number // the bit (0-28) in the block version field used to signal this softfork (only for "started" status)
      start_time: number //the minimum median time past of a block at which the bit gains its meaning
      timeout: number //the median time past of a block at which the deployment is considered failed if not yet locked in
      since: number //height of the first block to which the status applies
      statistics?: {
        //numeric statistics about BIP9 signalling for a softfork (only for "started" status)
        period: number //the length in blocks of the BIP9 signalling period
        threshold: number //the number of blocks with the version bit set required to activate the feature
        elapsed: number //the number of blocks elapsed since the beginning of the current period
        count: number //the number of blocks with the version bit set in the current period
        possible: boolean //returns false if there are not enough blocks left in this period to pass activation threshold
      }
    }
    height: number //height of the first block which the rules are or will be enforced (only for "buried" type, or "bip9" type with "active" status)
    active: boolean //true if the rules are enforced for the mempool and the next block
  }
>

export type Block = {
  hash: string
  confirmations: number
  height: number
  version: number
  versionHex: string
  merkleroot: string
  time: number
  mediantime: number
  nonce: number
  bits: string
  difficulty: number
  chainwork: string
  nTx: number
  previousblockhash: string
  strippedsize: number
  size: number
  weight: number
  tx: string[]
}

export type ChainTip = {
  height: number
  hash: string
  branchlen: number
  status: 'invalid' | 'headers-only' | 'valid-headers' | 'valid-fork' | 'active'
}
