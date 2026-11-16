// Alpha's page kit, the blocks a document reads best with: rows of a label and its value, a few
// items as bars with their share, and a paragraph set apart. Drawn in either look, from the
// window's variables, like every other block (kit.js).
//
//   {pairs: {title?, note?, items: [{label, value, unit?, note?, tone?, change?, open?}]}}
//   {bars: {title?, note?, items: [{label, value, unit?, note?, change?, open?}]}}
//   {callout: {title?, text, note?}}              text may be a list of paragraphs
;(() => {
  const kit = window.alphaKit
  if (!kit) return
  const { el, opener, tone, changes, titled, isMoney } = kit.parts
  const { fmt } = kit
  const amount = (v) => (isMoney(v) ? Number(v.amount) : Number(v))

  // a label on the left, its value on the right, a few words after it
  kit.blocks.pairs = (p) => {
    const items = p.items ?? []
    const body = el(
      'div',
      { class: 'ak-pairs' },
      items.map((i) =>
        el('div', { ...opener(i.open), class: `ak-pair${i.open ? ' ak-open' : ''}` }, [
          el('span', { class: 'ak-pair__label', text: String(i.label ?? '') }),
          el('span', { class: 'ak-pair__right' }, [
            el('span', { class: `ak-pair__value${tone(i.tone)}`, text: fmt(i.value, i.unit) }),
            ...changes(i.change),
            i.note ? el('span', { class: 'ak-pair__note', text: String(i.note) }) : null,
          ]),
        ]),
      ),
    )
    return titled(p.title, p.note, body, ' ak-bare')
  }

  // a few items side by side, each a bar as tall as its share of the largest
  kit.blocks.bars = (b) => {
    const items = (b.items ?? []).slice(0, 8)
    const top = Math.max(0, ...items.map((i) => amount(i.value)).filter((n) => !Number.isNaN(n)))
    const body = el(
      'div',
      { class: 'ak-bars' },
      items.map((i) => {
        const n = amount(i.value)
        const h = top > 0 && n > 0 ? Math.max(3, Math.round((n / top) * 100)) : 0
        return el('div', { ...opener(i.open), class: `ak-bar${i.open ? ' ak-open' : ''}` }, [
          el('div', { class: 'ak-bar__label', text: String(i.label ?? '') }),
          el('div', { class: 'ak-bar__track' }, [
            el('div', { class: 'ak-bar__fill', style: `height: ${h}%` }),
          ]),
          el('div', { class: 'ak-bar__value', text: fmt(i.value, i.unit) }),
          i.note ? el('div', { class: 'ak-bar__note', text: String(i.note) }) : null,
          ...changes(i.change),
        ])
      }),
    )
    return titled(b.title, b.note, body, ' ak-bare')
  }

  // a paragraph or a few, set apart with a rule at their left
  kit.blocks.callout = (c) => {
    const paragraphs = (Array.isArray(c.text) ? c.text : [c.text])
      .map((t) => String(t ?? '').trim())
      .filter(Boolean)
    return el('section', { class: 'ak-callout' }, [
      c.title ? el('h3', { class: 'ak-title', text: String(c.title) }) : null,
      ...paragraphs.map((t) => el('p', { text: t })),
      c.note ? el('p', { class: 'ak-note', text: String(c.note) }) : null,
    ])
  }
})()
