// A page's runtime inside its frame: `alpha`, the page's one way out of the frame.
// A page asks for its module's rows and their history, offers choosers (a month, a client), asks
// the window to open rows, and draws Alpha's blocks with `alpha.page`. In the window, questions go
// to the window by message; printed, to the core that prints it. Nothing here can write: a text
// the person edits in place (alpha.edit) goes to the window, which writes it to the row as theirs.
;(() => {
  const asked = new Map()
  let seq = 0
  const printing = typeof window.alphaAsk === 'function'
  // printed: the choices the window had when the person asked for the PDF
  const given = window.alphaInputs ?? {}
  const inputs = new Map()
  let maker = null
  let blocks = []
  let drawnWidth = 0
  let editing = false // a draw waits while a text is edited, so the edit is not wiped
  let missed = false

  const post = (message) => {
    if (!printing) parent.postMessage(message, '*')
  }

  const ask = (op, args) => {
    if (printing)
      return window.alphaAsk(JSON.stringify({ op, args })).then((text) => {
        const answer = JSON.parse(text)
        if (answer.problem) throw new Error(answer.problem)
        return answer.value
      })
    return new Promise((resolve, reject) => {
      seq += 1
      asked.set(seq, { resolve, reject })
      post({ alpha: 'ask', id: seq, op, args })
    })
  }

  window.addEventListener('message', (e) => {
    if (e.source !== parent) return
    const m = e.data ?? {}
    if (m.alpha === 'answer' && asked.has(m.id)) {
      const waiting = asked.get(m.id)
      asked.delete(m.id)
      if (m.problem) waiting.reject(new Error(m.problem))
      else waiting.resolve(m.value)
    } else if (m.alpha === 'theme') {
      const root = document.documentElement
      for (const [name, value] of Object.entries(m.vars ?? {})) root.style.setProperty(name, value)
      root.dataset.theme = m.dark ? 'dark' : 'light'
      draw()
    } else if (m.alpha === 'refresh') {
      // the module's rows changed: the page asks again
      run()
    }
  })

  const values = () => Object.fromEntries([...inputs].map(([name, i]) => [name, i.value]))

  // A chooser: its value now, the first option unless the person picked another.
  const input = (name, spec = {}) => {
    const options = (spec.options ?? []).map(String)
    const was = inputs.get(name)
    const want = was?.value ?? given[name] ?? (spec.value == null ? options[0] : String(spec.value))
    inputs.set(name, {
      label: spec.label ?? name,
      options,
      value: options.includes(want) ? want : options[0],
    })
    return inputs.get(name).value
  }

  const choose = (name, value) => {
    const i = inputs.get(name)
    if (!i) return
    i.value = value
    post({ alpha: 'inputs', values: values() })
    run()
  }

  // the page's own height, not the frame's: the window sizes the frame to it
  const height = () =>
    post({ alpha: 'height', height: Math.ceil(document.body.getBoundingClientRect().height) })

  function draw() {
    if (!window.alphaKit) return
    if (editing) {
      missed = true
      return
    }
    drawnWidth = document.documentElement.clientWidth
    window.alphaKit.draw(blocks, { inputs, choose, printing })
    height()
  }

  let runs = 0
  function run() {
    if (!maker) return
    runs += 1
    const mine = runs
    Promise.resolve()
      .then(() => maker())
      .then(
        (made) => {
          if (mine === runs) blocks = Array.isArray(made) ? made : []
        },
        (err) => {
          if (mine === runs) blocks = [{ problem: String(err?.message ?? err) }]
        },
      )
      .then(() => {
        if (mine !== runs) return
        draw()
        post({ alpha: 'inputs', values: values() })
        // printed or looked at: drawn, in its fonts
        document.fonts.ready.then(() => {
          window.alphaReady = true
        })
      })
  }

  // a chart redraws for a new width; anything else only says its height
  const watch = () =>
    new ResizeObserver(() => {
      if (document.documentElement.clientWidth !== drawnWidth) draw()
      else height()
    }).observe(document.documentElement)

  // A text edited in place, with ✕ and ✓ under it, as the window's Cancel and Save (Vikas, 23
  // Nov): Enter saves, Escape cancels, clicking elsewhere leaves it open. A change goes to the
  // window, which writes it to the field `target` names; the page then draws again from the row.
  const ICON = {
    yes: '<path d="M20 6 9 17l-5-5"/>',
    no: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  }
  const edit = (node, target) => {
    if (printing || editing) return
    editing = true
    const was = node.textContent.trim()
    const bar = document.createElement('div')
    const key = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        finish(true)
      } else if (e.key === 'Escape') finish(false)
    }
    function finish(keep) {
      bar.remove()
      node.removeEventListener('keydown', key)
      node.contentEditable = 'false'
      node.classList.remove('ak-editing')
      const now = node.textContent.trim()
      if (keep && now && now !== was) post({ alpha: 'edit', target, was, now })
      else node.textContent = was
      editing = false
      if (missed) {
        missed = false
        draw()
      } else height()
    }
    const button = (yes) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = yes ? 'ak-yes' : 'ak-no'
      b.setAttribute('aria-label', yes ? 'Save' : 'Cancel')
      b.innerHTML = `<svg viewBox="0 0 24 24">${yes ? ICON.yes : ICON.no}</svg><span>${yes ? 'Save' : 'Cancel'}</span>`
      // the text keeps its focus until the click lands
      b.addEventListener('mousedown', (e) => e.preventDefault())
      b.addEventListener('click', () => finish(yes))
      return b
    }
    bar.className = 'ak-edit-bar'
    bar.append(button(false), button(true))
    node.contentEditable = 'plaintext-only'
    node.classList.add('ak-editing')
    node.addEventListener('keydown', key)
    node.focus()
    document.getSelection()?.selectAllChildren(node)
    // under the text, its right edge with the text's
    const at = node.getBoundingClientRect()
    bar.style.top = `${at.bottom + window.scrollY + 4}px`
    bar.style.right = `${Math.max(4, document.documentElement.clientWidth - at.right - window.scrollX)}px`
    document.body.append(bar)
    height()
  }

  window.alpha = {
    rows: (table) => ask('rows', { table }),
    history: (table, field) => ask('history', { table, field }),
    input,
    open: (target) => post({ alpha: 'open', target }),
    edit,
    say: (words, agent) => post({ alpha: 'say', words, ...(agent ? { agent } : {}) }),
    page: (fn) => {
      if (!maker) watch()
      maker = fn
      run()
    },
    printing,
    // the record it is drawn for, on that record's page: its row's id; none on its module's tab
    record: window.alphaRecord ?? null,
  }
})()
