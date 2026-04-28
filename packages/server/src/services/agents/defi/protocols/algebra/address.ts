import { type Address, encodeAbiParameters, getContractAddress, keccak256 } from 'viem'

/**
 * Computes the Algebra Integral pool address for a token pair.
 *
 * @param poolDeployer - The address of the AlgebraPoolDeployer contract
 * @param tokenA - Address of the first token
 * @param tokenB - Address of the second token
 * @param poolInitCodeHash - The keccak256 hash of the AlgebraPool init bytecode
 */
export function computePoolAddress(
  poolDeployer: Address,
  tokenA: Address,
  tokenB: Address,
  poolInitCodeHash: `0x${string}` = '0x6ec6c9c8091d160c0aa74b2b14ba9c1717e95093bd3ac085cee99a49aab294a4',
): Address {
  // 1. Sort tokens (Algebra requires token0 < token1)
  const [token0, token1] = tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA]

  // 2. Generate the salt: keccak256(abi.encode(token0, token1))
  const salt = keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'address' }], [token0, token1]))

  // 3. Compute CREATE2 address
  return getContractAddress({
    from: poolDeployer,
    salt,
    bytecodeHash: poolInitCodeHash,
    opcode: 'CREATE2',
  })
}
