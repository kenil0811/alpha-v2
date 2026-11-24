// Alpha's page kit: the blocks a page is drawn with, in Alpha's look. Line weights,
// gaps, type and colours are decided here, from the window's own variables, never by a page.
//
//   alpha.page(async () => [ ...blocks ])
//
//   {heading: 'This week', note?, level?: 1, aside?, asideNote?, open?, asideOpen?}
//            a section's title; level 1 is the page's own title, aside its words at the right
//   {text: '…'} or '…'                             a paragraph
//   {stats: [{label, value, unit?, of?, change?: {value, unit?, label?, better?: 'up'|'down'},
//             tone?, note?, open?}]}   change may be a list: on last month, on last year
//   {chart: {title?, kind: 'line'|'bar', rows, x, series: [{field, label?, unit?}],
//            target?: {value, label?}, note?, current?}}   current: the x whose bars stand out
//   {table: {title?, note?, columns: [{field, label?, unit?}], rows}}
//            a cell may be {value, of?, tone?, open?, note?}
//   {list: {title?, items: [{text, tone?, open?}]}}
//   {card: {title?, text}}
//   {grid: {columns?, blocks}}
//   {button: {label, says, agent?}}              asks Alpha, as the person, from this page; agent
//                                                names one of the module's agents, asked instead
//   {pairs: {title?, note?, items: [{label, value, unit?, note?, tone?, change?, open?}]}}
//   {bars: {title?, note?, items: [{label, value, unit?, note?, change?, open?}]}}
//   {callout: {title?, text, note?}}              text may be a list of paragraphs
//   {flow: {title?, note?, steps: [{label, note?, tone?, open?}]}}   steps in order
//   (pairs, bars, callout and flow are in doc.js)
//
// <meta name="alpha-look" content="document"> draws the page as a document, in the window's width
// and theme: small section labels, soft tiles and bare tables; printed on white.
//   a chart series may be {kind: 'bar'|'line', axis: 'right'} to mix bars and a line on two axes
//
// A value is a number, words, a date ('2026-10-20') or money ({amount, currency}); `tone` is
// good, warn or bad; `open` is what the window opens on a click: {table, rows: [ids]} or
// {table, row, field?}. A value from one row's field ({table, row, field}) opens its source beside
// the page on a click, which waits a moment for a second one, and a double-click asks the window
// to edit it there: the window draws its own editor over it and writes what the person types to
// the field's whole value. The page itself writes nothing.
;(() => {
  const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  const SERIES = ['--accent', '--ink-3', '--warn', '--good', '--bad']
  const TONES = new Set(['good', 'warn', 'bad'])

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag)
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue
      if (k === 'text') node.textContent = v
      else if (k === 'onclick') node.addEventListener('click', v)
      else if (k === 'ondblclick') node.addEventListener('dblclick', v)
      else node.setAttribute(k, v === true ? '' : v)
    }
    for (const c of children) if (c) node.append(c)
    return node
  }
  function svg(tag, attrs = {}, children = []) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag)
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'text') node.textContent = v
      else node.setAttribute(k, v)
    }
    for (const c of children) if (c) node.append(c)
    return node
  }

  const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)
  const isMoney = (v) => v != null && typeof v === 'object' && 'amount' in v

  function money(v) {
    const n = Number(v.amount)
    if (Number.isNaN(n)) return '—'
    const sign = n < 0 ? '−' : ''
    const a = Math.abs(n)
    const short =
      a >= 1e6
        ? `${trim(a / 1e6, a >= 1e7 ? 1 : 2)}M`
        : a >= 1e4
          ? `${trim(a / 1e3, a >= 1e5 ? 0 : 1)}K`
          : Math.round(a).toLocaleString('en-US')
    return `${sign}$${short}`
  }
  const trim = (n, places) => String(Number(n.toFixed(places)))

  function day(v) {
    const d = Number(v.slice(8, 10))
    return `${d} ${MONTHS[Number(v.slice(5, 7)) - 1] ?? ''}`
  }

  function fmt(v, unit) {
    if (v == null || v === '') return '—'
    if (isMoney(v)) return money(v)
    if (isDate(v)) return day(v)
    if (typeof v !== 'number') return String(v)
    const a = Math.abs(v)
    const text =
      a >= 100 || Number.isInteger(v)
        ? Math.round(v).toLocaleString('en-US')
        : String(Number(v.toFixed(a >= 10 ? 1 : 2)))
    if (!unit) return text
    return unit === '%' ? `${text}%` : `${text} ${unit}`
  }
  // a value as a number; one not given is missing, never zero
  const num = (v) =>
    v == null || v === ''
      ? Number.NaN
      : isMoney(v)
        ? Number(v.amount)
        : typeof v === 'number'
          ? v
          : Number(v)

  // A click opens the target. A value from one row's field also edits on a double-click, so its
  // click waits a quarter second for a second one (T4); the window is asked to edit what the value
  // shows ([data-value]), not its label.
  function opener(target) {
    if (!target) return {}
    const open = () => window.alpha.open(target)
    if (!target.row || !target.field || window.alpha.printing)
      return { class: 'ak-open', role: 'link', tabindex: '0', onclick: open }
    let wait = 0
    return {
      class: 'ak-open',
      role: 'link',
      tabindex: '0',
      onclick: () => {
        clearTimeout(wait)
        wait = setTimeout(open, 250)
      },
      ondblclick: (e) => {
        clearTimeout(wait)
        const node = e.currentTarget
        window.alpha.edit(target, node.querySelector('[data-value]') ?? node)
      },
    }
  }

  const tone = (t) => (TONES.has(t) ? ` ak-tone-${t}` : '')

  // ---- blocks ----
  function heading(h) {
    const main = el('div', {}, [
      el(h.level === 1 ? 'h1' : 'h2', { ...opener(h.open), text: String(h.heading) }),
      h.note ? el('p', { class: 'ak-note', text: String(h.note) }) : null,
    ])
    const aside =
      h.aside != null
        ? el('div', { class: 'ak-heading__aside' }, [
            el('strong', { ...opener(h.asideOpen), text: String(h.aside) }),
            h.asideNote ? el('p', { class: 'ak-note', text: String(h.asideNote) }) : null,
          ])
        : null
    return el('div', { class: `ak-heading${h.level === 1 ? ' ak-heading--title' : ''}` }, [
      main,
      aside,
    ])
  }

  // a change, or a list of them (on last month, on last year), each with its own words
  function changes(list) {
    const all = (Array.isArray(list) ? list : list ? [list] : []).filter(
      (c) => c && c.value != null,
    )
    return all.map((c) => {
      // a change in money says it as money (+$318)
      const n = isMoney(c.value) ? Number(c.value.amount) : Number(c.value)
      const size = isMoney(c.value)
        ? money({ ...c.value, amount: Math.abs(n) })
        : fmt(Math.abs(n), c.unit)
      const better = c.better === 'down' ? n < 0 : n > 0
      return el('div', { class: `ak-change ${n === 0 ? '' : better ? 'ak-up' : 'ak-down'}` }, [
        el('span', { text: `${n > 0 ? '+' : n < 0 ? '−' : ''}${size}` }),
        c.label ? el('span', { class: 'ak-change__label', text: ` ${c.label}` }) : null,
      ])
    })
  }

  function stat(s) {
    const value = el('div', { class: `ak-stat__value${tone(s.tone)}` }, [
      el('span', { 'data-value': true, text: fmt(s.value, s.unit) }),
      s.of != null ? el('span', { class: 'ak-stat__of', text: ` / ${fmt(s.of, s.unit)}` }) : null,
    ])
    return el('div', { ...opener(s.open), class: s.open ? 'ak-stat ak-open' : 'ak-stat' }, [
      el('div', { class: 'ak-stat__label', text: String(s.label ?? '') }),
      value,
      ...changes(s.change),
      s.note ? el('div', { class: 'ak-note', text: String(s.note) }) : null,
    ])
  }
  const stats = (list) => el('div', { class: 'ak-stats' }, list.map(stat))

  function titled(title, note, body, extra = '') {
    return el('section', { class: `ak-card${extra}` }, [
      title ? el('h3', { class: 'ak-title', text: String(title) }) : null,
      body,
      note ? el('p', { class: 'ak-note', text: String(note) }) : null,
    ])
  }

  function cell(v, unit) {
    if (v != null && typeof v === 'object' && !isMoney(v)) {
      const text = `${fmt(v.value, unit)}${v.of != null ? ` / ${fmt(v.of, unit)}` : ''}`
      return {
        text,
        numeric: v.value == null || typeof v.value === 'number' || isMoney(v.value),
        attrs: { title: v.note ?? null, ...opener(v.open) },
        tone: v.tone,
      }
    }
    return { text: fmt(v, unit), numeric: typeof v === 'number' || isMoney(v), attrs: {} }
  }

  function table(t) {
    const rows = t.rows ?? []
    const columns = t.columns ?? (rows[0] ? Object.keys(rows[0]).map((field) => ({ field })) : [])
    if (!rows.length)
      return titled(t.title, t.note, el('p', { class: 'ak-empty', text: 'Nothing to show yet.' }))
    const numeric = columns.map((c) =>
      rows.some((r) => {
        const v = r[c.field]
        return cell(v, c.unit).numeric && v != null && typeof v !== 'string'
      }),
    )
    const head = el(
      'tr',
      {},
      columns.map((c, i) =>
        el('th', {
          class: numeric[i] ? 'ak-num' : null,
          text: `${c.label ?? c.field}${c.unit && c.unit !== '%' ? ` (${c.unit})` : ''}`,
        }),
      ),
    )
    const body = rows.map((r) =>
      el(
        'tr',
        {},
        columns.map((c, i) => {
          const x = cell(r[c.field], c.unit)
          return el('td', { class: `${numeric[i] ? 'ak-num' : ''}${tone(x.tone)}` }, [
            el('span', { ...x.attrs, text: x.text }),
          ])
        }),
      ),
    )
    const scroll = el('div', { class: 'ak-scroll' }, [
      el('table', { class: 'ak-table' }, [el('thead', {}, [head]), el('tbody', {}, body)]),
    ])
    return titled(t.title, t.note, scroll)
  }

  function list(l) {
    const items = l.items ?? []
    const body = items.length
      ? el(
          'ul',
          { class: 'ak-list' },
          items.map((i) =>
            el('li', { class: tone(i.tone).trim() || null }, [
              el('span', { ...opener(i.open), text: String(i.text ?? '') }),
            ]),
          ),
        )
      : el('p', { class: 'ak-empty', text: 'Nothing to show yet.' })
    return titled(l.title, l.note, body)
  }

  function card(c) {
    return titled(
      c.title,
      null,
      el('p', { class: 'ak-text', text: String(c.text ?? '') }),
      ' ak-card--box',
    )
  }

  const nice = (max) => {
    if (!(max > 0)) return { top: 1, step: 0.25 }
    const raw = max / 4
    const pow = 10 ** Math.floor(Math.log10(raw))
    const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)
    return { top: Math.ceil(max / step) * step, step }
  }

  // A chart: bars and lines over the same rows, a series on the right-hand axis when it says so
  // (revenue as bars, its margin as a line); a dashed goal line on the left axis.
  function chart(c, width) {
    const rows = c.rows ?? []
    const series = (c.series ?? []).map((s, i) => ({
      ...s,
      kind: s.kind ?? (c.kind === 'bar' ? 'bar' : 'line'),
      right: s.axis === 'right',
      colour: `var(${SERIES[i % SERIES.length]})`,
    }))
    if (!rows.length || !series.length)
      return titled(c.title, c.note, el('p', { class: 'ak-empty', text: 'Nothing to draw yet.' }))
    const legend =
      series.length > 1
        ? el(
            'div',
            { class: 'ak-legend' },
            series.map((s) =>
              el('span', {}, [
                el('i', { style: `background: ${s.colour}` }),
                el('span', { text: `${s.label ?? s.field}${s.right ? ' (right)' : ''}` }),
              ]),
            ),
          )
        : null
    // one scale per axis, from the values its series carry
    const axisOf = (list, withTarget) => {
      if (!list.length) return null
      let max = 0
      let min = 0
      for (const s of list)
        for (const r of rows) {
          const v = num(r[s.field])
          if (!Number.isNaN(v)) {
            max = Math.max(max, v)
            min = Math.min(min, v)
          }
        }
      if (withTarget && c.target?.value != null) max = Math.max(max, Number(c.target.value))
      const scale = nice(Math.max(max, -min, 0))
      const first = list[0]
      const money = rows.some((r) => isMoney(r[first.field]))
      return {
        top: scale.top,
        bottom: min < 0 ? -nice(-min).top : 0,
        step: scale.step,
        label: (v) => (money ? money_(v) : fmt(v, first.unit)),
      }
    }
    const money_ = (v) => money({ amount: v })
    const L =
      axisOf(
        series.filter((s) => !s.right),
        true,
      ) ?? axisOf(series, true)
    const R = axisOf(
      series.filter((s) => s.right),
      false,
    )
    const H = 220
    const width_ = (ax) =>
      ax ? 10 + Math.max(ax.label(ax.top).length, ax.label(ax.bottom).length) * 6.5 : 12
    const padL = width_(L)
    const padR = R ? width_(R) : 12
    const padT = 10
    const padB = 26
    const W = Math.max(280, width)
    const iw = W - padL - padR
    const ih = H - padT - padB
    const n = rows.length
    const bars = series.filter((s) => s.kind === 'bar')
    const anyBar = bars.length > 0
    const px = (i) =>
      anyBar ? padL + (i + 0.5) * (iw / n) : padL + (n === 1 ? iw / 2 : (i * iw) / (n - 1))
    const py = (v, ax) => padT + ih - ((v - ax.bottom) / (ax.top - ax.bottom)) * ih
    const g = svg('svg', { class: 'ak-svg', viewBox: `0 0 ${W} ${H}`, width: W, height: H })
    const steps = Math.round((L.top - L.bottom) / L.step)
    for (let k = 0; k <= steps; k++) {
      const t = L.bottom + k * L.step
      const y = py(t, L)
      g.append(
        svg('line', {
          x1: padL,
          x2: W - padR,
          y1: y,
          y2: y,
          class: Math.abs(t) < 1e-9 ? 'ak-axis' : 'ak-grid',
        }),
      )
      g.append(
        svg('text', { x: padL - 6, y: y + 4, class: 'ak-tick ak-tick--l', text: L.label(t) }),
      )
      if (R) {
        // the right axis names the same heights in its own units
        const v = R.bottom + ((t - L.bottom) / (L.top - L.bottom)) * (R.top - R.bottom)
        g.append(svg('text', { x: W - padR + 6, y: y + 4, class: 'ak-tick', text: R.label(v) }))
      }
    }
    const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 58))))
    rows.forEach((r, i) => {
      if (i % every !== 0 && i !== n - 1) return
      const x = r[c.x]
      g.append(
        svg('text', {
          x: px(i),
          y: H - 7,
          class: 'ak-tick ak-tick--x',
          text: isDate(x) ? day(x) : String(x ?? ''),
        }),
      )
    })
    if (c.target?.value != null) {
      const ty = py(Number(c.target.value), L)
      g.append(svg('line', { x1: padL, x2: W - padR, y1: ty, y2: ty, class: 'ak-target' }))
      g.append(
        svg('text', {
          x: W - padR - 2,
          y: ty - 5,
          class: 'ak-tick ak-tick--target',
          text: String(c.target.label ?? `goal ${L.label(c.target.value)}`),
        }),
      )
    }
    const bw = anyBar ? Math.max(2, ((iw / n) * 0.62) / bars.length) : 0
    bars.forEach((s, bi) => {
      const ax = s.right && R ? R : L
      rows.forEach((r, i) => {
        const v = num(r[s.field])
        if (Number.isNaN(v)) return
        const x = px(i) - (bw * bars.length) / 2 + bi * bw
        const y0 = py(0, ax)
        const y = py(v, ax)
        const past = c.current != null && String(r[c.x]) !== String(c.current)
        g.append(
          svg(
            'rect',
            {
              x,
              y: Math.min(y, y0),
              width: Math.max(1, bw - 1),
              height: Math.abs(y0 - y),
              rx: 1.5,
              style: `fill: ${s.colour}${past ? '; fill-opacity: 0.32' : ''}`,
            },
            [svg('title', { text: `${r[c.x]}: ${ax.label(v)}` })],
          ),
        )
      })
    })
    for (const s of series.filter((x) => x.kind !== 'bar')) {
      const ax = s.right && R ? R : L
      let run = []
      const flush = () => {
        if (run.length)
          g.append(
            svg('polyline', {
              points: run.join(' '),
              class: 'ak-line',
              style: `stroke: ${s.colour}`,
            }),
          )
        run = []
      }
      rows.forEach((r, i) => {
        const v = num(r[s.field])
        if (Number.isNaN(v)) flush()
        else run.push(`${px(i)},${py(v, ax)}`)
      })
      flush()
      if (n <= 40)
        rows.forEach((r, i) => {
          const v = num(r[s.field])
          if (Number.isNaN(v)) return
          g.append(
            svg('circle', { cx: px(i), cy: py(v, ax), r: 2, style: `fill: ${s.colour}` }, [
              svg('title', { text: `${r[c.x]}: ${ax.label(v)}` }),
            ]),
          )
        })
    }
    return titled(c.title, c.note, el('div', {}, [legend, g]), ' ak-chart')
  }

  // A button that asks Alpha, in the person's words, from this page; the page itself writes
  // nothing. {button: {label: 'Draft this month’s insights', says: 'Draft the key insights…'}}
  function button(b) {
    if (window.alpha?.printing) return null
    const node = el('button', {
      class: 'ak-button',
      type: 'button',
      text: String(b.label ?? b.says),
    })
    node.addEventListener('click', () => {
      window.alpha.say(String(b.says ?? b.label), b.agent ? String(b.agent) : undefined)
      node.disabled = true
      node.textContent = 'Asked Alpha'
    })
    return el('div', { class: 'ak-actions' }, [node])
  }

  function grid(gr, width) {
    const columns = Math.max(1, Math.min(4, gr.columns ?? 2))
    const narrow = width < 640
    const inner = narrow ? width : (width - 16 * (columns - 1)) / columns
    return el(
      'div',
      {
        class: 'ak-grid',
        style: `grid-template-columns: repeat(${narrow ? 1 : columns}, minmax(0, 1fr))`,
      },
      (gr.blocks ?? []).map((b) => block(b, inner - 34)),
    )
  }

  function block(b, width) {
    if (b == null) return null
    if (typeof b === 'string') return el('p', { class: 'ak-text', text: b })
    if (b.problem != null)
      return el('div', { class: 'ak-card ak-problem' }, [
        el('p', { text: `This page could not draw itself: ${b.problem}` }),
      ])
    if (b.heading != null) return heading(b)
    if (b.stat) return stats([b.stat])
    if (b.stats) return stats(b.stats)
    if (b.chart) return chart(b.chart, width)
    if (b.table) return table(b.table)
    if (b.list) return list(b.list)
    if (b.card) return card(b.card)
    if (b.grid) return grid(b.grid, width)
    if (b.button) return button(b.button)
    if (b.text != null) return el('p', { class: 'ak-text', text: String(b.text) })
    for (const [name, draw] of Object.entries(EXTRA)) if (b[name]) return draw(b[name], width)
    return el('p', {
      class: 'ak-empty',
      text: `A block the kit does not know: ${Object.keys(b).join(', ')}`,
    })
  }

  function choosers(inputs, choose, printing) {
    if (!inputs.size) return null
    return el(
      'div',
      { class: 'ak-choosers' },
      [...inputs].map(([name, i]) => {
        if (printing)
          return el('span', { class: 'ak-chooser' }, [
            el('span', { class: 'ak-chooser__label', text: `${i.label} ` }),
            el('strong', { text: i.value }),
          ])
        const select = el(
          'select',
          { 'aria-label': i.label },
          i.options.map((o) => el('option', { value: o, selected: o === i.value, text: o })),
        )
        select.addEventListener('change', () => choose(name, select.value))
        return el('label', { class: 'ak-chooser' }, [
          el('span', { class: 'ak-chooser__label', text: i.label }),
          select,
        ])
      }),
    )
  }

  // A heading and the block after it stay together, on screen and on a printed page.
  function kept(nodes, given) {
    const out = []
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      if (!node) continue
      if (given[i]?.heading != null && nodes[i + 1] && given[i + 1]?.heading == null) {
        out.push(el('div', { class: 'ak-keep' }, [node, nodes[i + 1]]))
        i++
      } else out.push(node)
    }
    return out
  }

  const EXTRA = {} // blocks of their own files (doc.js): name → draw(spec, width)
  const isDocument = () =>
    document.querySelector('meta[name="alpha-look"]')?.getAttribute('content') === 'document'

  let root = null
  let desk = null
  function draw(blocks, { inputs, choose, printing }) {
    const doc = isDocument()
    if (!root) {
      document.body.classList.toggle('ak-doc', doc)
      desk = doc ? el('div', { class: 'ak-desk' }) : null
      root = el('main', { class: doc ? 'ak-page ak-sheet' : 'ak-page' })
      document.body.append(...[desk, root].filter(Boolean))
    }
    const css = getComputedStyle(root)
    const inner =
      (root.clientWidth || document.documentElement.clientWidth - 56) -
      (doc ? Number.parseFloat(css.paddingLeft) + Number.parseFloat(css.paddingRight) : 0)
    const width = doc ? inner : inner - 34
    const given = blocks.filter((b) => b != null)
    const nodes = kept(
      given.map((b) => block(b, width)),
      given,
    )
    const chooser = choosers(inputs, choose, printing)
    if (doc) {
      // a document's choosers sit on the desk above it, never on the printed page
      desk.replaceChildren(...(chooser && !printing ? [chooser] : []))
      root.replaceChildren(...nodes)
    } else root.replaceChildren(...[chooser, ...nodes].filter(Boolean))
  }

  window.alphaKit = {
    draw,
    fmt,
    money,
    // for doc.js's blocks
    blocks: EXTRA,
    parts: { el, opener, tone, changes, titled, isMoney },
  }
  // a page formats its own words the same way: alpha.fmt(value, unit), alpha.money(value)
  if (window.alpha) Object.assign(window.alpha, { fmt, money })
})()
