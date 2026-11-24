// What Alpha read: the report, per source, as the person may see it, and its live line alone,
// fetched again as the core says a read counted something (a 'read' event on the window's socket).
import type { BaseCtx } from '../ctx.ts'
import { readLine, readReport } from '../read-report.ts'
import type { ReadReportView } from '../read-types.ts'

export function registerReadReport(ctx: BaseCtx): void {
  ctx.app.get('/api/read-report', async (): Promise<ReadReportView> => readReport(ctx))
  ctx.app.get('/api/read-report/line', async () => readLine(ctx))
}
