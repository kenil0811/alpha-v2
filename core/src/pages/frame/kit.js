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
//   {button: {label, says}}                      asks Alpha, as the person, from this page
//   {controls: [input names]}                    those choosers or sliders here, not at the top
//   {bars: {title?, items: [{label, value, note?, change?, open?}]}}   columns of bars
//   {rows: {title?, items: [{label, value, note?, tone?, open?}]}}     label and value, a line each
//   {callout: {title?, text}}                    words set apart, a rule at their left
//   {heading, title: true} is the page's title; a chart may say labels: true (values on it) and
//   highlight: 'last'; <meta name="alpha-look" content="snapshot"> asks for the snapshot look
//   a chart series may be {kind: 'bar'|'line', axis: 'right'} to mix bars and a line on two axes
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
  const SERIES = ['--ak-s1', '--ak-s2', '--ak-s3', '--ak-s4', '--ak-s5']
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
  // a value as a number; one not given is missing, never zero
  const num = (v) =>
    v == null || v === ''
      ? Number.NaN
      : isMoney(v)
        ? Number(v.amount)
        : typeof v === 'number'
          ? v
          : Number(v)

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
    return el('div', { class: h.title ? 'ak-heading ak-heading--title' : 'ak-heading' }, [
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
    return el('div', { ...opener(s.open), class: s.open ? 'ak-stat ak-open' : 'ak-stat' }, [
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

  // Columns of bars, one an item, each with its amount, share and change under it (a month's
  // top expenses). {bars: {title?, note?, items: [{label, value, note?, change?, open?}]}}
  function bars(b) {
    const items = b.items ?? []
    const top = Math.max(...items.map((i) => Math.abs(num(i.value)) || 0), 0) || 1
    const body = items.length
      ? el(
          'div',
          {
            class: 'ak-bars',
            style: `grid-template-columns: repeat(${items.length}, minmax(0, 1fr))`,
          },
          items.map((i) => {
            const h = Math.max(2, Math.round(((Math.abs(num(i.value)) || 0) / top) * 80))
            const c = i.change
            const n = c ? Number(c.value) : 0
            const better = c?.better === 'down' ? n < 0 : n > 0
            return el(
              'div',
              { ...opener(i.open), class: i.open ? 'ak-bars__col ak-open' : 'ak-bars__col' },
              [
                el('div', { class: 'ak-bars__label', text: String(i.label ?? '') }),
                el('div', { class: 'ak-bars__well' }, [
                  el('div', { class: 'ak-bars__bar', style: `height: ${h}px` }),
                ]),
                el('div', { class: 'ak-bars__value', text: fmt(i.value, i.unit) }),
                i.note ? el('div', { class: 'ak-note', text: String(i.note) }) : null,
                c && c.value != null
                  ? el('div', {
                      class: `ak-change ${n === 0 ? '' : better ? 'ak-up' : 'ak-down'}`,
                      text:
                        n === 0
                          ? `no change${c.label ? ` ${c.label}` : ''}`
                          : `${n > 0 ? '▲' : '▼'}${fmt(Math.abs(n), c.unit)}${c.label ? ` ${c.label}` : ''}`,
                    })
                  : null,
              ],
            )
          }),
        )
      : el('p', { class: 'ak-empty', text: 'Nothing to show yet.' })
    return titled(b.title, b.note, body, ' ak-bars-card')
  }

  // Label and value, a line each (a month at a glance). {rows: {title?, items: [{label, value,
  // unit?, note?, tone?, open?}]}}
  function rowsBlock(r) {
    const body = el(
      'div',
      { class: 'ak-rows' },
      (r.items ?? []).map((i) =>
        el('div', { ...opener(i.open), class: i.open ? 'ak-rows__row ak-open' : 'ak-rows__row' }, [
          el('span', { class: 'ak-rows__label', text: String(i.label ?? '') }),
          el('span', { class: `ak-rows__value${tone(i.tone)}` }, [
            el('strong', { text: fmt(i.value, i.unit) }),
            i.note ? el('span', { class: 'ak-rows__note', text: ` ${i.note}` }) : null,
          ]),
        ]),
      ),
    )
    return titled(r.title, r.note, body, ' ak-rows-card')
  }

  // Words set apart with a rule at their left (the month's key insights). {callout: {title?, text}}
  function callout(c) {
    return el('section', { class: 'ak-callout' }, [
      c.title ? el('strong', { text: String(c.title) }) : null,
      el('p', { text: String(c.text ?? '') }),
    ])
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
        const lit = c.highlight === 'last' && i === n - 1
        g.append(
          svg(
            'rect',
            {
              x,
              y: Math.min(y, y0),
              width: Math.max(1, bw - 1),
              height: Math.abs(y0 - y),
              rx: 1.5,
              style: `fill: ${lit ? 'var(--ak-strong)' : s.colour}`,
            },
            [svg('title', { text: `${r[c.x]}: ${ax.label(v)}` })],
          ),
        )
        // each bar's value over it, when the chart asks and they fit
        if (c.labels && bw >= 18)
          g.append(
            svg('text', {
              x: x + bw / 2,
              y: Math.min(y, y0) - 4,
              class: 'ak-tick ak-tick--x',
              text: ax.label(v),
            }),
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
          if (c.labels && n <= 13)
            g.append(
              svg('text', {
                x: px(i),
                y: py(v, ax) - 7,
                class: 'ak-tick ak-tick--x ak-tick--strong',
                text: ax.label(v),
              }),
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
      window.alpha.say(String(b.says ?? b.label))
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
    if (b.controls) {
      const picked = new Map([...drawing.inputs].filter(([n]) => b.controls.includes(n)))
      return el('div', { class: 'ak-card ak-controls' }, [
        choosers(picked, drawing.choose, drawing.printing),
      ])
    }
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
    if (b.bars) return bars(b.bars)
    if (b.rows) return rowsBlock(b.rows)
    if (b.callout) return callout(b.callout)
    if (b.grid) return grid(b.grid, width)
    if (b.button) return button(b.button)
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
            el('strong', {
              text:
                i.range?.unit === '$' ? money({ amount: i.value }) : fmt(i.value, i.range?.unit),
            }),
          ])
        if (i.range) {
          const shown = (v) => (i.range.unit === '$' ? money({ amount: v }) : fmt(v, i.range.unit))
          const out = el('strong', { class: 'ak-chooser__value', text: shown(i.value) })
          const slider = el('input', {
            type: 'range',
            'aria-label': i.label,
            min: i.range.min,
            max: i.range.max,
            step: i.range.step,
            value: i.value,
          })
          slider.addEventListener('input', () => {
            out.textContent = shown(Number(slider.value))
          })
          slider.addEventListener('change', () => choose(name, slider.value))
          return el('label', { class: 'ak-chooser ak-chooser--range' }, [
            el('span', { class: 'ak-chooser__label', text: i.label }),
            slider,
            out,
          ])
        }
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
  let drawing = { inputs: new Map(), choose: () => {}, printing: false }
  function draw(blocks, { inputs, choose, printing }) {
    drawing = { inputs, choose, printing }
    // the inputs a block places ({controls: [names]}) are drawn there, not at the top
    const placed = new Set(blocks.flatMap((b) => b?.controls ?? []))
    const fixed = window.alphaFixed ?? []
    const top = new Map([...inputs].filter(([n]) => !placed.has(n) && !fixed.includes(n)))
    if (!root) {
      // a page may ask for one of the kit's looks: <meta name="alpha-look" content="snapshot">
      const look = document.querySelector('meta[name="alpha-look"]')?.getAttribute('content')
      root = el('main', { class: look ? `ak-page ak-look-${look}` : 'ak-page' })
      document.body.append(root)
    }
    const width = root.clientWidth || document.documentElement.clientWidth - 56
    root.replaceChildren(
      ...[choosers(top, choose, printing), ...blocks.map((b) => block(b, width - 34))].filter(
        Boolean,
      ),
    )
  }

  window.alphaKit = { draw, fmt, money }
  // a page formats its own words the same way: alpha.fmt(value, unit), alpha.money(value)
  if (window.alpha) Object.assign(window.alpha, { fmt, money })
})()
