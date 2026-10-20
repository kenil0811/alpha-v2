// Alpha's page kit (design §13): the blocks a page is drawn with, in Alpha's look. Line weights,
// gaps, type and colours are decided here, from the window's own variables, never by a page.
//
//   alpha.page(async () => [ ...blocks ])
//
//   {heading: 'This week', note?}                 a section's title
//   {text: '…'} or '…'                             a paragraph
//   {stats: [{label, value, unit?, of?, change?: {value, unit?, label?, better?: 'up'|'down'},
//             tone?, note?, open?}]}
//   {chart: {title?, kind: 'line'|'bar', rows, x, series: [{field, label?, unit?}],
//            target?: {value, label?}, note?}}
//   {table: {title?, note?, columns: [{field, label?, unit?}], rows}}
//            a cell may be {value, of?, tone?, open?, note?}
//   {list: {title?, items: [{text, tone?, open?}]}}
//   {card: {title?, text}}
//   {grid: {columns?, blocks}}
//
// A value is a number, words, a date ('2026-10-20') or money ({amount, currency}); `tone` is
// good, warn or bad; `open` is what the window opens on a click: {table, rows: [ids]} or
// {table, row, field?}.
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
  const num = (v) => (isMoney(v) ? Number(v.amount) : typeof v === 'number' ? v : Number(v))

  function opener(target) {
    if (!target) return {}
    return {
      class: 'ak-open',
      role: 'link',
      tabindex: '0',
      onclick: () => window.alpha.open(target),
    }
  }

  const tone = (t) => (TONES.has(t) ? ` ak-tone-${t}` : '')

  // ---- blocks ----
  function heading(h) {
    return el('div', { class: 'ak-heading' }, [
      el('h2', { text: String(h.heading) }),
      h.note ? el('p', { class: 'ak-note', text: String(h.note) }) : null,
    ])
  }

  function stat(s) {
    const value = el('div', { class: `ak-stat__value${tone(s.tone)}` }, [
      el('span', { text: fmt(s.value, s.unit) }),
      s.of != null ? el('span', { class: 'ak-stat__of', text: ` / ${fmt(s.of, s.unit)}` }) : null,
    ])
    let change = null
    if (s.change && s.change.value != null) {
      const c = s.change
      const n = Number(c.value)
      const better = c.better === 'down' ? n < 0 : n > 0
      change = el('div', { class: `ak-change ${n === 0 ? '' : better ? 'ak-up' : 'ak-down'}` }, [
        el('span', { text: `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n), c.unit)}` }),
        c.label ? el('span', { class: 'ak-change__label', text: ` ${c.label}` }) : null,
      ])
    }
    return el('div', { class: 'ak-stat', ...opener(s.open) }, [
      el('div', { class: 'ak-stat__label', text: String(s.label ?? '') }),
      value,
      change,
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
    return titled(c.title, null, el('p', { class: 'ak-text', text: String(c.text ?? '') }))
  }

  const nice = (max) => {
    if (!(max > 0)) return { top: 1, step: 0.25 }
    const raw = max / 4
    const pow = 10 ** Math.floor(Math.log10(raw))
    const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)
    return { top: Math.ceil(max / step) * step, step }
  }

  function chart(c, width) {
    const rows = c.rows ?? []
    const series = c.series ?? []
    const bar = c.kind === 'bar'
    if (!rows.length || !series.length)
      return titled(c.title, c.note, el('p', { class: 'ak-empty', text: 'Nothing to draw yet.' }))
    const legend =
      series.length > 1
        ? el(
            'div',
            { class: 'ak-legend' },
            series.map((s, i) =>
              el('span', {}, [
                el('i', { style: `background: var(${SERIES[i % SERIES.length]})` }),
                el('span', { text: s.label ?? s.field }),
              ]),
            ),
          )
        : null
    let max = 0
    let min = 0
    for (const s of series)
      for (const r of rows) {
        const v = num(r[s.field])
        if (!Number.isNaN(v)) {
          max = Math.max(max, v)
          min = Math.min(min, v)
        }
      }
    if (c.target?.value != null) max = Math.max(max, Number(c.target.value))
    const unit = series[0]?.unit
    const scale = nice(Math.max(max, -min))
    const top = scale.top
    const bottom = min < 0 ? -nice(-min).top : 0
    const label = (v) => (isMoney(rows[0]?.[series[0].field]) ? money({ amount: v }) : fmt(v, unit))
    const H = 220
    const padL = 10 + Math.max(...[top, bottom].map((v) => label(v).length)) * 6.5
    const padR = 12
    const padT = 10
    const padB = 26
    const W = Math.max(280, width)
    const iw = W - padL - padR
    const ih = H - padT - padB
    const n = rows.length
    const px = (i) =>
      bar ? padL + (i + 0.5) * (iw / n) : padL + (n === 1 ? iw / 2 : (i * iw) / (n - 1))
    const py = (v) => padT + ih - ((v - bottom) / (top - bottom)) * ih
    const g = svg('svg', { class: 'ak-svg', viewBox: `0 0 ${W} ${H}`, width: W, height: H })
    for (let t = bottom; t <= top + 1e-9; t += scale.step) {
      const y = py(t)
      g.append(
        svg('line', {
          x1: padL,
          x2: W - padR,
          y1: y,
          y2: y,
          class: t === 0 ? 'ak-axis' : 'ak-grid',
        }),
      )
      g.append(svg('text', { x: padL - 6, y: y + 4, class: 'ak-tick ak-tick--l', text: label(t) }))
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
      const ty = py(Number(c.target.value))
      g.append(svg('line', { x1: padL, x2: W - padR, y1: ty, y2: ty, class: 'ak-target' }))
      g.append(
        svg('text', {
          x: W - padR - 2,
          y: ty - 5,
          class: 'ak-tick ak-tick--target',
          text: String(c.target.label ?? `goal ${label(c.target.value)}`),
        }),
      )
    }
    const bw = bar ? Math.max(2, ((iw / n) * 0.62) / series.length) : 0
    series.forEach((s, si) => {
      const colour = `var(${SERIES[si % SERIES.length]})`
      if (bar) {
        rows.forEach((r, i) => {
          const v = num(r[s.field])
          if (Number.isNaN(v)) return
          const x = px(i) - (bw * series.length) / 2 + si * bw
          const y0 = py(0)
          const y = py(v)
          g.append(
            svg(
              'rect',
              {
                x,
                y: Math.min(y, y0),
                width: Math.max(1, bw - 1),
                height: Math.abs(y0 - y),
                rx: 1.5,
                style: `fill: ${colour}`,
              },
              [svg('title', { text: `${r[c.x]}: ${label(v)}` })],
            ),
          )
        })
        return
      }
      const points = rows.map((r, i) => {
        const v = num(r[s.field])
        return Number.isNaN(v) ? null : `${px(i)},${py(v)}`
      })
      let run = []
      const flush = () => {
        if (run.length)
          g.append(
            svg('polyline', {
              points: run.join(' '),
              class: 'ak-line',
              style: `stroke: ${colour}`,
            }),
          )
        run = []
      }
      for (const p of points) {
        if (p) run.push(p)
        else flush()
      }
      flush()
      if (n <= 40)
        rows.forEach((r, i) => {
          const v = num(r[s.field])
          if (Number.isNaN(v)) return
          g.append(
            svg('circle', { cx: px(i), cy: py(v), r: 2, style: `fill: ${colour}` }, [
              svg('title', { text: `${r[c.x]}: ${label(v)}` }),
            ]),
          )
        })
    })
    return titled(c.title, c.note, el('div', {}, [legend, g]), ' ak-chart')
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
    if (b.text != null) return el('p', { class: 'ak-text', text: String(b.text) })
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

  let root = null
  function draw(blocks, { inputs, choose, printing }) {
    if (!root) {
      root = el('main', { class: 'ak-page' })
      document.body.append(root)
    }
    const width = root.clientWidth || document.documentElement.clientWidth - 56
    root.replaceChildren(
      ...[choosers(inputs, choose, printing), ...blocks.map((b) => block(b, width - 34))].filter(
        Boolean,
      ),
    )
  }

  window.alphaKit = { draw, fmt, money }
  // a page formats its own words the same way: alpha.fmt(value, unit), alpha.money(value)
  if (window.alpha) Object.assign(window.alpha, { fmt, money })
})()
