// An answer shape as the API takes it, and the answer back as Alpha asked for it (step 3, part
// 1's round, 30-31 Oct). Alpha writes "may be empty" as a list of types (`["string", "null"]`);
// Claude Code takes that, but the API refuses a list of types with an enum, and allows at most
// 16 fields that may be one of several types and 24 that may be left out (its structured-output
// limits). The document reader asks for one field per thing it wants, so a kit's dozens of fields
// pass both. Here no field is either: each "may be empty" becomes an object with `empty` (yes or
// no) and `value` beside it, every object is closed and every field required, and the answer is
// turned back, an empty one to null, before anything reads it.

type Node = Record<string, unknown>

const EMPTY =
  'Where the instructions say null: empty is true, and value is any value of its kind, which is ignored.'

// The shape sent to the API.
export function apiShape(given: unknown): unknown {
  if (Array.isArray(given)) return given.map(apiShape)
  if (!given || typeof given !== 'object') return given
  const node = given as Node
  const inner = notNull(node)
  if (inner)
    return {
      type: 'object',
      description: [node.description, EMPTY].filter(Boolean).join(' '),
      additionalProperties: false,
      properties: { empty: { type: 'boolean' }, value: apiShape(inner) },
      required: ['empty', 'value'],
    }
  const out: Node = {}
  for (const [k, v] of Object.entries(node))
    out[k] =
      k === 'properties' || k === '$defs'
        ? Object.fromEntries(Object.entries(v as Node).map(([n, x]) => [n, apiShape(x)]))
        : ['items', 'anyOf', 'allOf'].includes(k)
          ? apiShape(v)
          : v
  if (node.type === 'object') {
    out.additionalProperties = false
    // every field required: one the model may leave out counts against the API's limit too
    if (node.properties) out.required = Object.keys(node.properties as Node)
  }
  return out
}

// The answer as Alpha's shape has it: an empty one null, everything else as it came.
export function fromApi(given: unknown, answer: unknown): unknown {
  if (!given || typeof given !== 'object' || answer === null || answer === undefined) return answer
  const node = given as Node
  const inner = notNull(node)
  if (inner) {
    const a = answer as { empty?: boolean; value?: unknown }
    return a.empty ? null : fromApi(inner, a.value)
  }
  if (node.type === 'array' && Array.isArray(answer))
    return answer.map((x) => fromApi(node.items, x))
  if (node.type === 'object' && node.properties && typeof answer === 'object')
    return Object.fromEntries(
      Object.entries(answer as Node).map(([k, v]) => [k, fromApi((node.properties as Node)[k], v)]),
    )
  return answer
}

// A shape that may be null, without its null: `["string", "null"]` with its enum less null.
function notNull(node: Node): Node | null {
  if (!Array.isArray(node.type) || !node.type.includes('null')) return null
  const types = (node.type as string[]).filter((t) => t !== 'null')
  if (types.length !== 1) return null
  const { type: _type, enum: values, ...rest } = node
  return {
    ...rest,
    type: types[0],
    ...(Array.isArray(values) ? { enum: values.filter((v) => v !== null) } : {}),
  }
}
