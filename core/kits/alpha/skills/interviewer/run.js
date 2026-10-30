// Interviewer: Interview me's pool refreshed and re-ranked; the most useful, as this run's result.
export default async (alpha) => {
  const { words, count, top } = await alpha.interview.prepare()
  return { words, count, top }
}
