const adom = (function () {

let fs = undefined
let path = undefined

try {
  fs = require('fs')
  path = require('path')
} catch (e) {}

function render (prog, config, mainFile) {
  let STATE = {
    cursor: 0,
    current: { type: '', data: '' },
    prev: { type: '', data: '' },
    file_index: 0,
    line: 1,
    file_name: mainFile || 'main'
  }

  let error_message = undefined
  let first_tag = false
  let layouts = {}
  let blocks = {}
  let scopes = []
  let files = [prog]
  let yield_state
  let file = files[0]
  let error = false
  let indents = -1
  let current_layout = undefined
  let current_block = undefined
  let current_classlist = []
  let current_idlist = []
  let current_accessorlist = []
  let current_arglist = []
  let scalar_value = undefined
  let current_depth = -1
  let output = ''
  let parse_only = false
  let in_layout_body = false
  let filters = {
    json: function (str) {
      return JSON.parse(str)
    }
  }

  config = config || {}

  if (config.filters) {
    filters = Object.assign(filters, config.filters)
  }

  function log_error (err, line) {
    error_message = 'Error (' + STATE.file_name + ') line ' + line + ': ' + err
    error = true
  }

  function set_state (state) {
    STATE.cursor = state.cursor || 0
    STATE.file_index = state.file_index || 0
    STATE.line = state.line || 1
    STATE.file_name = state.file_name || mainFile || 'main'
    if (state.current) {
      STATE.current.type = state.current.type || ''
      STATE.current.data = state.current.data || ''
    } else {
      STATE.current.type = ''
      STATE.current.data = ''
    }
    file = files[STATE.file_index]
  }

  function get_state () {
    return {
      cursor: STATE.cursor,
      current: { type: STATE.current.type, data: STATE.current.data },
      file_index: STATE.file_index,
      line: STATE.line
    }
  }

  function emit_indents () {
    if (config.formatted !== true) return
    let space = ''
    for (let i = 0; i < indents; i++) {
      space += '    '
    }
    output += space
  }

  function emit_text (str) {
    output += str
  }

  function accept (type) {
    if (error) return
    if (STATE.current.type === type) {
      next()
      return true
    } else {
      return false
    }
  }

  function expect (type) {
    if (error) return
    if (STATE.current.type !== type) {
      log_error('Unexpected token: ' + STATE.current.type, STATE.line)
      return false
    } else {
      next()
      return true
    }
  }

  function peek (type) {
    if (error) return
    if (STATE.current.type === type) {
      return true
    } else {
      return false
    }
  }

  function parse_data () {
    if (!expect('const')) return
    const id = STATE.current.data
    const line = STATE.line
    let is_file = false
    let filter = undefined
    if (!expect('identifier')) return
    if (scopes[0][id] !== undefined) {
      log_error('constant has already been declared: ' + id, line)
      return
    }
    if (accept('file')) {
      is_file = true
    }
    if (accept(':')) {
      filter = STATE.current.data
      if (!expect('identifier')) return
    }
    if (peek('string')) {
      let str = interpolate_values(STATE.current.data)
      let line = STATE.line
      if (is_file) {
        str = load_file(str)
      }
      if (filter !== undefined) {
        if (filters[filter]) {
          str = filters[filter](str)
        } else {
          log_error('unknown filter: ' + filter, line)
        }
      }
      scopes[0][id] = str
      next()
    } else if (peek('number')) {
      scopes[0][id] = STATE.current.data
      next()
    } else {
      log_error('unexpected token: ' + STATE.current.data, STATE.line)
    }
  }

  function load_file (filename) {
    let data = undefined
    if (fs && path) {
      data = fs.readFileSync(path.resolve(config.dirname || __dirname, filename), 'utf-8')
    }
    return data
  }

  const doctypes = {
    'html5': '<!DOCTYPE html>'
  }

  function doctype () {
    if (accept('doctype')) {
      const id = STATE.current.data
      if (!expect('identifier')) return
      if (doctypes[id]) {
        if (parse_only === false) {
          emit_text(doctypes[id] + '\n')
        }
      } else {
        log_error('Uknown Doctype: ' + id, STATE.line)
      }
    }
  }


  function elementlist () {
    if (error) return
    if (peek('doctype')) {
      doctype()
      elementlist()
    } if (accept('run')) {
      let f = STATE.current.data
      let line = STATE.line
      if (!expect('string')) return
      let fdata = load_file(f)
      if (fdata) {
        let state = get_state()
        files.push(fdata)
        set_state({ file_index: files.length - 1, file_name: f })
        run()
        set_state(state)
      }
      elementlist()
    } else if (peek('const')) {
      parse_data()
      elementlist()
    } else if (peek('identifier')) {
      element()
      elementlist()
    } else if (peek('raw')) {
      innertext()
      elementlist()
    } else if (peek('each')) {
      eachstatement()
      elementlist()
    } else if (peek('if')) {
      ifstatement()
      elementlist()
    } else if (peek('use')) {
      if (!expect('use')) return
      if (!expect('[')) return
      let id = STATE.current.data
      let line = STATE.line
      if (!expect('identifier')) return
      if (id === current_layout) {
        log_error('cannot call a layout from within itself: ' + id, line)
        return
      }
      if (parse_only === false) {
        let layout = layouts[id]
        if (layout) {
          let local_data = {}
          current_arglist = []
          valuelist()
          if (!expect(']')) return
          current_arglist.forEach(function (arg, idx) {
            local_data[layout.args[idx]] = arg
          })
          current_arglist = []
          if (!expect('[')) return
          yield_state = get_state()
          let prev_state = yield_state
          set_state(layout)
          scopes.push(local_data)
          in_layout_body = true
          current_depth++
          parse_block_body()
          current_depth--
          in_layout_body = false
          scopes.pop()
          set_state(prev_state)
          parse_only = true
          elementlist()
          parse_only = false
          if (!expect(']')) return
          elementlist()
        } else {
          log_error('Unknown layout: ' + id, line)
          return
        }
      } else {
        valuelist()
        if (!expect('[')) return
        elementlist()
        if (!expect(']')) return
        elementlist()
      }
    } else if (peek('yield')) {
      if (in_layout_body) {
        if (!expect('yield')) return
        if (parse_only === false) {
          let current_state = get_state()
          set_state(yield_state)
          in_layout_body = false
          elementlist()
          in_layout_body = true
          set_state(current_state)
          elementlist()
        } else {
          elementlist()
        }
      } else {
        log_error('yield can only be used inside of a layout', STATE.line)
        return
      }
    } else if (peek('layout')) {
      if (in_layout_body) {
        log_error('Cannot define a layout in another layout', STATE.line)
        return
      }
      let t = parse_only
      parse_only = true
      parse_layout()
      parse_only = t
      elementlist()
    } else if (peek('block')) {
      parse_only = true
      parse_block()
      parse_only = false
      elementlist()
    } else if (accept('[')) {
      let id = STATE.current.data
      let line = STATE.line
      if (parse_only === false) {
        if (!expect('identifier')) return
        let state = blocks[id]
        if (state) {
          let local_data = {}
          current_arglist = []
          valuelist()
          current_arglist.forEach(function (arg, idx) {
            local_data[state.args[idx]] = arg
          })
          current_arglist = []
          let prev_state = get_state()
          set_state(state)
          scopes.push(local_data)
          current_depth++
          parse_block_body()
          set_state(prev_state)
          if (!expect(']')) return
          current_depth--
          scopes.pop()
          elementlist()
        } else {
          log_error('Unknown tag: ' + id, line)
          return
        }
      } else {
        if (!expect('identifier')) return
        if (id === current_block) {
          log_error('cannot call a block from within itself: ' + id, line)
          return
        }
        valuelist()
        if (!expect(']')) return
        elementlist()
      }
    }
  }

  function parse_block_body () {
    if (!expect('[')) return
    elementlist()
    if (!expect(']')) return
  }

  function arglist () {
    let id = STATE.current.data
    if (accept('identifier')) {
      current_arglist.push(id)
      arglist()
    }
  }

  function parse_layout () {
    in_layout_body = true
    if (!expect('layout')) return
    let id = STATE.current.data
    if (!expect('identifier')) return
    current_arglist = []
    arglist()
    current_layout = id
    layouts[id] = {
      cursor: STATE.cursor,
      current: {
        type: STATE.current.type,
        data: STATE.current.data
      },
      file_index: STATE.file_index,
      line: STATE.line,
      args: current_arglist
    }
    current_arglist = []
    parse_block_body()
    in_layout_body = false
    current_layout = undefined
  }

  function parse_block () {
    if (!expect('block')) return
    let id = STATE.current.data
    current_block = id
    if (!expect('identifier')) return
    current_arglist = []
    arglist()
    blocks[id] = {
      cursor: STATE.cursor,
      current: {
        type: STATE.current.type,
        data: STATE.current.data
      },
      file_index: STATE.file_index,
      line: STATE.line,
      args: current_arglist
    }
    current_arglist = []
    parse_block_body()
    current_block = undefined
  }

  function value () {
    if (peek('identifier')) {
      scalar_value = undefined
      variable()
    } else if (peek('string') || peek('number') || peek('bool') || peek('null')) {
      scalar_value = STATE.current.data
      next()
    }
  }

  function valuelist () {
    if (peek('string')) {
      value()
      current_arglist.push(interpolate_values(compute_value()))
      valuelist()
    } else if (peek('identifier') || peek('number') || peek('bool')) {
      value()
      current_arglist.push(compute_value())
      valuelist()
    }
  }

  function parse_cmp () {
    if (!accept('<=') && !accept('<') && !accept('>=') && !accept('>') && !accept('==') && !accept('!=')) {
      log_error('Unexpected token ' + STATE.current.type, STATE.line)
      return
    }
  }

  function ifstatement () {
    if (error) return
    if (!expect('if')) return
    value()
    if (parse_only === false) {
      let val = compute_value()
      let v1 = {
        type: val == null ? 'null' : (typeof val),
        data: val
      }
      let is_true
      let cmp = STATE.current.data
      let line = STATE.line
      parse_cmp()
      value()
      val = compute_value()
      let v2 = {
        type: val == null ? 'null' : (typeof val),
        data: val
      }
      if (v1.type !== v2.type && v1.type !== 'null' && v2.type !== 'null') {
        log_error('Cannot compare ' + v1.type + ' and ' + v2.type, line)
        return
      }
      if (cmp !== '==' && cmp !== '!=' && v1.type === 'string' && v2.type === 'string') {
        log_error('Operator can only be used on numbers', line)
        return
      }
      switch (cmp) {
        case '<=':
          is_true = (v1.data <= v2.data)
          break
        case '<':
          is_true = (v1.data < v2.data)
          break
        case '>=':
          is_true = (v1.data >= v2.data)
          break
        case '>':
          is_true = (v1.data > v2.data)
          break
        case '==':
          is_true = (v1.data == v2.data)
          break
        case '!=':
          is_true = (v1.data != v2.data)
          break
      }

      if (is_true === false) {
        parse_only = true
      }

      if (!expect('{')) return
      elementlist()
      if (!expect('}')) return

      parse_only = false

      if (accept('else')) {
        if (is_true === true) {
          parse_only = true
        }

        if (!expect('{')) return
        elementlist()
        if (!expect('}')) return

        parse_only = false
      }
    } else {
      parse_cmp()
      value()
      if (!expect('{')) return
      elementlist()
      if (!expect('}')) return
      if (accept('else')) {
        if (!expect('{')) return
        elementlist()
        if (!expect('}')) return
      }
    }
  }

  function eachstatement () {
    if (error) return
    if (!expect('each')) return
    let it = STATE.current.data
    if (!expect('identifier')) return
    if (!expect('in')) return
    if (parse_only === false) {
      let line = STATE.line
      variable()
      let data = compute_value()
      if (!expect('{')) return
      let state = get_state()
      if (data !== undefined && data.forEach !== undefined) {
        data.forEach(function (d) {
          scopes.push({ [it]: d })
          current_depth++
          set_state(state)
          elementlist()
          current_depth--
          scopes.pop()
        })
      } else {
        log_error('Cannot use each with ' + (typeof data) + ' type', line)
        return
      }
      if (!expect('}')) return
    } else {
      variable()
      if (!expect('{')) return
      elementlist()
      if (!expect('}')) return
    }
  }

  function element () {
    if (error) return
    indents++
    let id = STATE.current.data
    if (accept('identifier')) {
      if (parse_only === false) {
        if (config.formatted === true) {
          if (first_tag === true) {
            emit_text('\n')
          } else {
            first_tag = true
          }
          emit_indents()
        }
        
        emit_text('<' + id)
      }
      tagdef()
      if (accept('[')) {
        if (parse_only === false) {
          emit_text('>')
        }
        let has_children = false
        if (peek('identifier') || peek('if') || peek('each') || peek('yield')) {
          has_children = true
        }
        elementlist()
        let prev = STATE.prev.type
        if (!expect(']')) return
        if (parse_only === false) {
          if (config.formatted && has_children) {
            emit_text('\n')
            emit_indents()
          }
          emit_text('</' + id + '>')
        }
      } else if (accept(';')) {
        if (parse_only === false) {
          emit_text('>')
        }
      } else {
        if (parse_only === false) {
          emit_text('>')
          innertext()
          emit_text('</' + id + '>')
        } else {
          innertext()
        }
      }
    } else {
      innertext()
    }
    indents--
  }

  function tagdef () {
    if (error) return
    tag()
    properties()
  }

  function tag () {
    if (error) return
    if (accept('.')) {
      classlist()
    } else if (accept('#')) {
      idlist()
    }
    if (parse_only === false) {
      if (current_idlist.length > 0) {
        emit_text(' id="' + current_idlist.join(' ') + '"')
        current_idlist = []
      }
      if (current_classlist.length > 0) {
        emit_text(' class="' + current_classlist.join(' ') + '"')
        current_classlist = []
      }
    }
  }

  function properties () {
    if (error) return
    if (peek('identifier')) {
      let id = STATE.current.data
      if (parse_only === false) {
        emit_text(' ' + id)
        next()
        if (accept('=')) {
          emit_text('="' + interpolate_values(STATE.current.data) + '"')
          if (!expect('string')) return
        }
        properties()
      } else {
        next()
        if (accept('=')) {
          if (!expect('string')) return
        }
        properties()
      }
    }
  }

  function variable () {
    let a = STATE.current.data
    if (!expect('identifier')) return
    scalar_value = undefined
    current_accessorlist = []
    current_accessorlist.push(a)
    accessor()
  }

  function accessor () {
    if (accept('.')) {
      let a = STATE.current.data
      if (!expect('identifier')) return
      current_accessorlist.push(a)
      accessor()
    } else if (accept('[')) {
      let line = STATE.line
      let a = STATE.current.data
      if (accept('string') || accept('number')) {
        if (!expect(']')) return
        current_accessorlist.push(a)
        accessor()
      } else {
        log_error('Unexpected token: ' + STATE.current.type, line)
      }
    }
  }

  function iterate_over_variables (data, fn) {
    let id = ''
    let start = 0, end = 0

    for (let i = 0; i < data.length; i++) {
      if (data[i] === '#' && data[i+1] === '{') {
        i += 2
        start = i
        while (data[i] !== '}' && i < data.length) {
          id += data[i++]
        }
        end = i - 1
        fn(id, start, end)
        id = ''
      }
    }
  }

  function compute_value () {
    let val
    if (scalar_value !== undefined) {
      return scalar_value
    }
    for (let i = current_depth; i >= 0; i--) {
      let ctx = scopes[i]
      if (ctx[current_accessorlist[0]]) {
        val = ctx[current_accessorlist[0]]
        break
      }
    }
    if (!val) {
      return undefined
    }
    for (let i = 1; i < current_accessorlist.length; i++) {
      val = val[current_accessorlist[i]]
    }
    return val
  }

  function compute_interpolated_value (val) {
    let state = get_state()
    if (!val.trim()) {
      log_error('string interpolant cannot be empty', STATE.line)
      return
    }
    files.push(val)
    set_state({
      line: STATE.line,
      file_index: files.length - 1
    })
    next()
    value()
    let v = compute_value()
    set_state(state)
    return v
  }

  function replace_values (data, values) {
    let outp = ''
    let start_index = 0

    for (let i = 0; i < values.length; i++) {
      let end_index = values[i].start_index - 2
      let v = compute_interpolated_value(values[i].variable)
      outp += (data.slice(start_index, end_index) + v)
      start_index = values[i].end_index + 2
    }
    let last = values[values.length - 1]

    if (last.end_index < (data.length - 2)) {
      outp += data.slice(last.end_index + 2)
    }
    return outp
  }

  function interpolate_values (str) {
    let values = []

    iterate_over_variables(str, function (id, start, end) {
      values.push({
        variable: id,
        start_index: start,
        end_index: end
      })
    })

    if (values.length > 0) {
      str = replace_values(str, values)
    }

    return str
  }

  function innertext () {
    if (error) return
    let data = STATE.current.data
    if (parse_only === false && data) {
      let txt = interpolate_values(data)
      if (txt) {
        emit_text(txt.trim())
      }
    }
    if (!expect('raw')) return
  }

  function classlist () {
    if (error) return
    if (parse_only === false) {
      current_classlist.push(STATE.current.data)
    }
    if (!expect('identifier')) return
    if (accept('.')) {
      classlist()
    } else if (accept('#')) {
      idlist()
    }
  }

  function idlist () {
    if (error) return
    if (parse_only === false) {
      current_idlist.push(STATE.current.data)
    }
    if (!expect('identifier')) return
    if (accept('.')) {
      classlist()
    } else if (accept('#')) {
      idlist()
    }
  }

  function is_alpha (c) {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
  }

  function is_num (c) {
    return c >= '0' && c <= '9'
  }

  function identifier (i) {
    let id = ''
    while (is_alpha(file[i]) || is_num(file[i]) || file[i] === '_' || file[i] === '-') {
      id += file[i++]
    }
    return id
  }

  function parse_string (i) {
    let str = ''
    let del = file[i++]
    let additional_length = 0
    while (file[i] !== del && i < file.length) {
      if (file[i] === '\n') {
        STATE.line++
      }
      if (file[i] === '\\') {
        additional_length++
        str += file[++i]
      } else {
        str += file[i]
      }
      i++
    }
    return {
      string: str,
      length: str.length + additional_length
    }
  }

  // cheating
  function parse_number (i) {
    let num = ''
    let dot_found = false
    while (i < file.length) {
      if (is_num(file[i])) {
        num += file[i]
      } else if (file[i] === '.' && dot_found === false) {
        num += file[i]
        dot_found = false
      } else {
        break
      }
      i++
    }
    return num
  }

  function parse_inner (i) {
    let inner = ''
    let additional_length = 0
    while (file[i] !== '|' && i < file.length) {
      if (file[i] === '\n') {
        STATE.line++
      }
      if (file[i] === '\\') {
        additional_length++
        inner += file[++i]
      } else {
        inner += file[i]
      }
      i++
    }
    return {
      data: inner,
      length: inner.length + additional_length
    }
  }

  function is_space (c) {
    return c === ' ' || c === '\t' || c === '\r' || c === '\n'
  }

  const symbols = [
    '[',
    ']',
    '.',
    '#',
    '(',
    ')',
    ';',
    ':'
  ]

  const keywords = [
    'each',
    'in',
    'if',
    'else',
    'block',
    'doctype',
    'const',
    'run',
    'file',
    'layout',
    'use',
    'yield'
  ]

  function skip_space () {
    while (is_space(file[STATE.cursor])) {
      if (file[STATE.cursor] === '\n') {
        STATE.line++
      }
      STATE.cursor++
    }
  }

  function next () {
    let c, data, type

    skip_space()

    if (STATE.cursor >= file.length) {
      STATE.current.type = 'eof',
      STATE.current.data = undefined
      return
    }

    if (file[STATE.cursor] === '/' && file[STATE.cursor+1] === '/') {
      if (file[STATE.cursor+1] === '/') {
        while (file[STATE.cursor] !== '\n' && STATE.cursor < file.length) {
          STATE.cursor++
        }
      }
      return next()
    }

    c = file[STATE.cursor]

    if (c === '!') {
      if (file[STATE.cursor+1] === '=') {
        type = '!='
        data = type
        STATE.cursor += 2
      } else {
        type = c
        data = c
        STATE.cursor++
      }
    } else if (c === '=') {
      if (file[STATE.cursor+1] === '=') {
        type = '=='
        data = type
        STATE.cursor += 2
      } else {
        type = c
        data = c
        STATE.cursor++
      }
    } else if (c === '>') {
      if (file[STATE.cursor+1] === '=') {
        type = '>='
        STATE.cursor += 2
      } else {
        type = '>'
        STATE.cursor++
      }
      data = type
    } else if (c === '<') {
      if (file[STATE.cursor+1] === '=') {
        type = '<='
        STATE.cursor += 2
      } else {
        type = '<'
        STATE.cursor++
      }
      data = type
    } else if (is_alpha(c)) {
      type = 'identifier'
      data = identifier(STATE.cursor)
      STATE.cursor += data.length
    } else if (symbols.indexOf(c) !== -1) {
      type = c
      data = c
      STATE.cursor++
    } else if (c === '"' || c === '\'') {
      type = 'string'
      let str = parse_string(STATE.cursor)
      data = str.string
      STATE.cursor += str.length + 2
    } else if (c === '|') {
      STATE.cursor++
      type = 'raw'
      let inner = parse_inner(STATE.cursor)
      data = inner.data
      STATE.cursor += inner.length + 1
    } else if (is_num(c)) {
      type = 'number'
      data = parse_number(STATE.cursor)
      STATE.cursor += data.length
      data = parseFloat(data)
    } else {
      type = file[STATE.cursor]
      data = file[STATE.cursor++]
    }

    if (keywords.indexOf(data) !== -1 && type === 'identifier') {
      type = data
    }

    if (data === 'null') {
      data = null
      type = 'null'
    }

    if ((data === 'true' || data === 'false') && type !== 'string') {
      type = 'bool'
      data = (data === 'true')
    }

    STATE.prev.type = STATE.current.type
    STATE.prev.data = STATE.current.data

    STATE.current.type = type
    STATE.current.data = data
  }

  function run () {
    next()
    elementlist()
    expect('eof')
  }

  scopes.push(config.data || {})
  current_depth++

  run()

  if (error) {
    throw new Error(error_message)
  } else {
    return output
  }
}

function renderFile (filepath, opts) {
  const str = fs.readFileSync(filepath, 'utf-8')
  return render(str, opts, filepath)
}

return {
  render: render,
  renderFile: renderFile
}

})()

if (typeof module !== 'undefined') {
  module.exports = adom
} else {
  window.adom = adom
}
