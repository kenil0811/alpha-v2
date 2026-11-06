// Kits (design §10): a module's folder with no person's rows, carrying setup rows, installed from
// a folder and updated by the ownership rule. Kits live outside alpha-v2, in a client's own
// repository. Read, shaped, installed and judged in the files here.
export { install, type UpdateReport, update } from './install.ts'
export { installedKits, type KitInfo, type KitManifest, readKit } from './read.ts'
export { checkSigned } from './signed.ts'
export { recordChange, takeBack, unseenChanges, type Yours, yours } from './yours.ts'
