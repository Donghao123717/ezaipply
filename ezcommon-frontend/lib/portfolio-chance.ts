/**
 * Probability of at least one admission offer across a school list.
 *
 * The obvious formula, 1 - ∏(1 - pᵢ), assumes the schools decide independently.
 * They don't: the same application goes to all of them, so a weak year, a thin
 * activity list, or an essay that doesn't land drags every decision the same
 * direction. Treating them as independent systematically overstates the odds of
 * getting in somewhere - which is exactly the number a student uses to decide
 * whether their list is safe enough.
 *
 * The correlated model here is a one-factor latent variable model (the same
 * shape used for correlated defaults in credit risk). School i admits when
 *
 *     Zᵢ = √ρ · M + √(1-ρ) · εᵢ  >  tᵢ ,   tᵢ = Φ⁻¹(1 - pᵢ)
 *
 * where M ~ N(0,1) is the shared "how strong is this applicant this cycle"
 * factor and εᵢ ~ N(0,1) is school-specific noise. Conditioning on M makes the
 * schools independent, so
 *
 *     P(no offers) = ∫ φ(m) · ∏ᵢ Φ( (tᵢ - √ρ·m) / √(1-ρ) ) dm
 *
 * integrated numerically. ρ = 0 reproduces the independent formula exactly;
 * ρ → 1 collapses toward the single best chance.
 */

/** How much of an admissions outcome is the shared applicant factor rather than
 * school-specific noise. Illustrative for a demo, not fitted to outcome data. */
export const ADMISSIONS_CORRELATION = 0.5

/** Abramowitz & Stegun 26.2.17 - plenty accurate for a displayed percentage. */
export function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const z = Math.abs(x) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * z)
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-z * z)
  return 0.5 * (1 + sign * y)
}

/** Acklam's rational approximation to the inverse normal CDF. */
export function normalInvCdf(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity

  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239]
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572]
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]

  const pLow = 0.02425
  const pHigh = 1 - pLow

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    )
  }
  if (p > pHigh) {
    const q = Math.sqrt(-2 * Math.log(1 - p))
    return -(
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    )
  }
  const q = p - 0.5
  const r = q * q
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  )
}

/** The naive answer: every school decides on its own. Overstates the odds. */
export function independentChance(chances: number[]): number {
  const usable = chances.filter((c) => c > 0)
  if (usable.length === 0) return 0
  const none = usable.reduce((acc, c) => acc * (1 - Math.min(c, 100) / 100), 1)
  return (1 - none) * 100
}

/**
 * P(at least one offer) once the schools are allowed to be correlated.
 * `chances` and the result are percentages, not fractions.
 */
export function portfolioChance(chances: number[], rho: number = ADMISSIONS_CORRELATION): number {
  const usable = chances.filter((c) => c > 0).map((c) => Math.min(c, 100) / 100)
  if (usable.length === 0) return 0
  if (usable.length === 1) return usable[0] * 100
  if (rho <= 0) return independentChance(chances)

  const thresholds = usable.map((p) => normalInvCdf(1 - p))
  const sqrtRho = Math.sqrt(rho)
  const sqrtRest = Math.sqrt(1 - rho)

  // Simpson's rule over the shared factor; ±6 SD covers the mass to well
  // beyond the precision of a percentage.
  const lo = -6
  const hi = 6
  const steps = 240 // even, so Simpson pairs up
  const h = (hi - lo) / steps
  let integral = 0

  for (let i = 0; i <= steps; i += 1) {
    const m = lo + i * h
    const density = Math.exp(-0.5 * m * m) / Math.sqrt(2 * Math.PI)
    let noneGivenM = 1
    for (const t of thresholds) {
      noneGivenM *= normalCdf((t - sqrtRho * m) / sqrtRest)
    }
    const weight = i === 0 || i === steps ? 1 : i % 2 === 1 ? 4 : 2
    integral += weight * density * noneGivenM
  }
  integral *= h / 3

  return Math.max(0, Math.min(1, 1 - integral)) * 100
}
