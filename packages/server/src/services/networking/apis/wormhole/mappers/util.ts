// TODO: TEMPORARY RESOLVE
export const TMP_ASSET_DECIMALS: Record<string, number> = {
  SOL: 9,
  WSOL: 9,
  SUI: 9,
  ETH: 18,
  WETH: 18,
}

/**
 * Pads a truncated raw `amount` string with trailing zeros so that its
 * scale matches the token's expected precision.
 *
 * Background:
 * - Wormholescan often truncates trailing zeros in the raw `amount` field.
 *   For example:
 *     - Reported: "1032254070"
 *     - Should be: "10322540700"
 *   while the formatted `tokenAmount` is `"10.3225407"` with 9 decimals.
 * - This patch reconstructs the expected raw integer by adding the missing
 *   trailing zeros based on `decimals` and the integer length of the
 *   `reportFormatted` string.
 *
 * Assumptions:
 * - `reportFormatted` is a trustworthy decimal string (not rounded).
 * - Only **trailing zeros** are missing (common Wormholescan bug).
 * - Note that normalizedDecimals = null in the Wormholescan response always
 * - Does not attempt to recover precision if `reportFormatted` itself
 *   is truncated/rounded.
 *
 * Example:
 *   - Wormholescan tx: https://wormholescan.io/#/tx/16/000000000000000000000000b1731c586ca89a23809861c6103f0b96b3f57d92/92864?network=Mainnet&view=advanced
 *   - Moonscan tx: https://moonscan.io/tx/0x88282911f1edc45de45d5dc070934bb4835cda9c4e13db932d12c0dd0172a3f2
 *   - Batch calldata example: 0x97dbe809547a934b636a48d547b1d0bd731c84c31d0edeffdcef9757063ffbb0
 *   - Check a WETH transfer for more dramatic truncation
 *
 * @param report          Raw amount as reported (possibly truncated)
 * @param reportFormatted Human-readable amount string (e.g. "10.3225407")
 * @param decimals        Token decimals (e.g. 9 for SOL, 18 for ETH)
 * @returns Corrected raw integer string if padding was needed, otherwise original `report`
 */
export function padAmountIfNeeded(report: string, reportFormatted: string, decimals: number): string {
  if (!report || !reportFormatted || decimals === 0) {
    return report
  }

  const [intPart] = reportFormatted.split('.')
  const requiredLength = intPart.length + decimals

  if (report.length < requiredLength) {
    return report + '0'.repeat(requiredLength - report.length)
  }

  return report
}
