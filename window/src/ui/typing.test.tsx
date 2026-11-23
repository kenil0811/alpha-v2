import { renderToString } from 'react-dom/server'
import { expect, it } from 'vitest'
import { Typing } from './typing.tsx'

it('keeps the whole line’s place from the first frame, and shows it all at once when asked', () => {
  const first = renderToString(<Typing text="Hi Vikas, I’m Alpha." />)
  // the final words reserved unseen, none typed yet
  expect(first).toMatch(/invisible[^>]*>Hi Vikas, I’m Alpha\./)
  const now = renderToString(<Typing text="Hi Vikas." now />)
  expect(now.match(/Hi Vikas\./g)?.length).toBe(3) // read aloud, reserved, shown
})
