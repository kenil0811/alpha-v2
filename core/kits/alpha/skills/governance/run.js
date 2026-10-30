// Governance: the day's review, or one refusal explained (alpha.input.refusal).
export default async (alpha) => {
  const { refusal, agent } = alpha.input
  if (refusal) return alpha.governance.explain({ refusal, ...(agent ? { agent } : {}) })
  return alpha.governance.review()
}
