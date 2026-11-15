// A run the desk starts is waited for only a short while (config/limits.yaml, run_wait_seconds):
// one that takes longer goes on by itself, so a turn is never held until a long read ends.

// The run's outcome when it ends within the wait, or that it is still going.
export async function within<T>(
  run: Promise<T>,
  seconds: number,
): Promise<{ done: true; out: T } | { done: false }> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<{ done: false }>((resolve) => {
    timer = setTimeout(() => resolve({ done: false }), seconds * 1000)
  })
  // one that fails after the wait says so on its own run's line, not as a failure nobody holds
  run.catch(() => undefined)
  try {
    return await Promise.race([run.then((out) => ({ done: true as const, out })), late])
  } finally {
    clearTimeout(timer)
  }
}
