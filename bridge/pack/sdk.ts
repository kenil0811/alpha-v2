// What the Bridge's connector processes take from the SDK, for its zip: a connector's shape, its
// check and its runtime, without the browser and the rest a computer's connector does not use.
// The zip is bundled with this in the SDK's place (scripts/bridge.ts).

export { checkConnector } from '../../connector-sdk/src/check.ts'
export * from '../../connector-sdk/src/connector.ts'
export { type HelperOptions, runHelper } from '../../connector-sdk/src/helper.ts'
export { type CallOptions, makeCall } from '../../connector-sdk/src/runtime.ts'
export { CONTACTS, EVENTS, who } from '../../connector-sdk/src/shared-tables.ts'
