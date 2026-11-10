// A table's frame before its shape is here: its toolbar and an empty grid in their places, so moving
// from one table to another changes what is in the frame and never takes the frame away.
import type { TableView } from '@alpha/core/api'

export const frameOf = (
  id: string,
  name: string,
  module: { id: string; name: string },
): TableView => ({
  id,
  name,
  about: null,
  aboutBy: null,
  module,
  mirror: null,
  managed: null,
  fields: [],
  documents: null,
  rows: [],
  names: {},
  views: [],
  readBy: [],
})
