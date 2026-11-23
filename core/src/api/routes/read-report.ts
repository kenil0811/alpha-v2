// What Alpha read: the report, per source, as the person may see it (api/read-report.ts).

import type { BaseCtx } from '../ctx.ts'
import { readReport } from '../read-report.ts'
import type { ReadReportView } from '../read-types.ts'

export function registerReadReport(ctx: BaseCtx): void {
  ctx.app.get('/api/read-report', async (): Promise<ReadReportView> => readReport(ctx))
}
