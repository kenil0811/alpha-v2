// The files connector: files read with their places, and watched folders (folder.ts, which is
// also what a folder of this connector exports for Alpha to load).
export { connector, folder, mimeOf } from './folder.ts'
export { doclingEnv, peekPdf, readPdf, renderPage } from './pdf.ts'
export { type Piece, type Position, type Readable, readBytes } from './read.ts'
export { type Cell, sheetBytes } from './write.ts'
