let fs = undefined
let path = undefined

try {
  fs = require('fs')
  path = require('path')
} catch (e) {}

function adomCompile (prog, input, config) {
  let STATE = {
    cursor: 0,
    current: { type: '', data: '' },
    file_index: 0,
    line: 1
  }

  let tags = {}
  let scopes = []
  let files = [prog]

  let file = files[0]
  let error = false
  let indents = -1
  let current_classlist = []
  let current_idlist = []
  let current_accessorlist = []
  let current_arglist = []
  let scalar_value = undefined
  let current_depth = -1
  let output = ''
  let parse_only = false
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
    console.log('Error line ' + line + ': ' + err)
    error = true
  }

  function set_state (state) {
    STATE.cursor = state.cursor || 0
    STATE.file_index = state.file_index || 0
    STATE.line = state.line || 1
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

  function emit_partial_line (str) {
    output += str
  }

  function emit_line (line) {
    emit_indents()
    emit_partial_line(line)
    if (config.formatted === true) {
      emit_partial_line('\n')
    }
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
    } else {
      next()
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
    expect('const')
    const id = STATE.current.data
    let is_file = false
    let filter = undefined
    expect('identifier')
    if (accept('file')) {
      is_file = true
    }
    if (accept(':')) {
      filter = STATE.current.data
      expect('identifier')
    }
    if (peek('string')) {
      let str = STATE.current.data
      let line = STATE.line
      if (is_file) {
        str = load_file(str)
      }
      if (filter !== undefined) {
        if (filters[filter]) { 
          str = filters[filter](str)
        } else {
          log_error('Unknown filter: ' + filter, line)
        }
      }
      scopes[0][id] = str
      next()
    } else if (peek('number')) {
      scopes[0][id] = STATE.current.data
      next()
    }
  }

  function load_file (filename) {
    let data = undefined
    if (fs && path) {
      data = fs.readFileSync(path.resolve(config.dirname || __dirname, filename), 'utf-8')
    }
    return data
  }

  function elementlist () {
    if (error) return
    if (accept('run')) {
      let f = STATE.current.data
      let line = STATE.line
      expect('string')
      let fdata = load_file(f)
      if (fdata) {
        let state = get_state()
        files.push(fdata)
        set_state({ file_index: files.length - 1 })
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
    } else if (peek('block')) {
      let t = parse_only
      parse_only = true
      parse_block()
      parse_only = t
      elementlist()
    } else if (accept('[')) {
      if (parse_only === false) {
        let id = STATE.current.data
        let line = STATE.line
        expect('identifier')
        let state = tags[id]
        if (state) {
          let local_data = {}
          current_arglist = []
          valuelist()
          current_arglist.forEach(function (arg, idx) {
            local_data[state.args[idx]] = arg
          })
          let prev_state = get_state()
          set_state(state)
          scopes.push(local_data)
          current_depth++
          parse_block_body()
          set_state(prev_state)
          expect(']')
          current_depth--
          scopes.pop()
          elementlist()
        } else {
          log_error('Unknown tag: ' + id, line)
          return
        }
      } else {
        expect('identifier')
        valuelist()
        expect(']')
        elementlist()
      }
    }
  }

  function parse_block_body () {
    expect('[')
    elementlist()
    expect(']')
  }

  function arglist () {
    let id = STATE.current.data
    if (accept('identifier')) {
      current_arglist.push(id)
      arglist()
    }
  }

  function parse_block () {
    expect('block')
    let id = STATE.current.data
    expect('identifier')
    current_arglist = []
    arglist()
    tags[id] = {
      cursor: STATE.cursor,
      current: {
        type: STATE.current.type,
        data: STATE.current.data
      },
      file_index: STATE.file_index,
      line: STATE.line,
      args: current_arglist
    }
    parse_block_body()
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
    if (peek('identifier') || peek('string') || peek('number') || peek('bool')) {
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
    expect('if')
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

      expect('{')
      elementlist()
      expect('}')

      parse_only = false

      if (accept('else')) {
        if (is_true === true) {
          parse_only = true
        }

        expect('{')
        elementlist()
        expect('}')

        parse_only = false
      }
    } else {
      parse_cmp()
      value()
      expect('{')
      elementlist()
      expect('}')
      if (accept('else')) {
        expect('{')
        elementlist()
        expect('}')
      }
    }
  }

  function eachstatement () {
    if (error) return
    expect('each')
    let it = STATE.current.data
    expect('identifier')
    expect('in')
    if (parse_only === false) {
      let line = STATE.line
      variable()
      let data = compute_value()
      expect('{')
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
      expect('}')
    } else {
      variable()
      expect('{')
      elementlist()
      expect('}')
    }
  }

  function element () {
    if (error) return
    indents++
    let id = STATE.current.data
    if (accept('identifier')) {
      if (parse_only === false) {
        emit_indents()
        emit_partial_line('<' + id)
      }
      tagdef()
      if (accept('[')) {
        if (parse_only === false) {
          if (config.formatted === true) {
            emit_partial_line('>\n')
          } else {
            emit_partial_line('>')
          }
        }
        elementlist()
        expect(']')
        if (parse_only === false) {
          emit_line('</' + id + '>')
        }
      } else if (accept(';')) {
        if (parse_only === false) {
          if (config.formatted === true) {
            emit_partial_line('>\n')
          } else {
            emit_partial_line('>')
          }
        }
      } else {
        if (parse_only === false) {
          if (config.formatted === true) {
            emit_partial_line('>\n')
          } else {
            emit_partial_line('>')
          }
          innertext()
          emit_line('</' + id + '>')
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
        emit_partial_line(' id="' + current_idlist.join(' ') + '"')
        current_idlist = []
      }
      if (current_classlist.length > 0) {
        emit_partial_line(' class="' + current_classlist.join(' ') + '"')
        current_classlist = []
      }
    }
  }

  function properties () {
    if (error) return
    if (peek('identifier')) {
      let id = STATE.current.data
      if (parse_only === false) {
        emit_partial_line(' ' + id)
        next()
        if (accept('=')) {
          emit_partial_line('="' + interpolate_values(STATE.current.data) + '"')
          expect('string')
        }
        properties()
      } else {
        next()
        if (accept('=')) {
          expect('string')
        }
        properties()
      }
    }
  }

  function variable () {
    let a = STATE.current.data
    expect('identifier')
    scalar_value = undefined
    current_accessorlist = []
    current_accessorlist.push(a)
    accessor()
  }

  function accessor () {
    if (accept('.')) {
      let a = STATE.current.data
      expect('identifier')
      current_accessorlist.push(a)
      accessor()
    } else if (accept('[')) {
      let a = STATE.current.data
      if (accept('string') || accept('number')) {
        expect(']')
        current_accessorlist.push(a)
        accessor()
      } else {
        log_error('Unexpected token: ' + STATE.current.type)
      }
    }
  }

  function iterate_over_variables (fn) {
    let id = ''
    let start = 0, end = 0
    let data = STATE.current.data

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

  function compute_interpolated_value (value) {
    let state = get_state()
    files.push(value)
    set_state({
      line: STATE.line,
      file_index: files.length - 1
    })
    next()
    variable()
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

    iterate_over_variables(function (id, start, end) {
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
    if (parse_only === false) {
      emit_line(interpolate_values(data))
    }
    expect('raw')
  }

  function classlist () {
    if (error) return
    if (parse_only === false) {
      current_classlist.push(STATE.current.data)
    }
    expect('identifier')
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
    expect('identifier')
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
    while (file[i] !== del && i < file.length) {
      if (file[i] === '\\') {
        str += file[++i]
      } else {
        str += file[i]
      }
      i++
    }
    return str
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
    while (file[i] !== '|' && i < file.length) {
      inner += file[i++]
    }
    return inner
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
    'file'
  ]

  function next () {
    let c, data, type

    while (is_space(file[STATE.cursor])) {
      if (file[STATE.cursor] === '\n') {
        STATE.line++
      }
      STATE.cursor++
    }
    c = file[STATE.cursor]

    if (STATE.cursor >= file.length) {
      STATE.current.type = 'eof',
      STATE.current.data = undefined
      return
    }

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
      data = parse_string(STATE.cursor)
      STATE.cursor += data.length + 2
    } else if (c === '|') {
      STATE.cursor++
      type = 'raw'
      data = parse_inner(STATE.cursor)
      STATE.cursor += data.length + 1
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

    if (data === 'true' || data === 'false') {
      type = 'bool'
      data = (data === 'true')
    }

    STATE.current.type = type
    STATE.current.data = data
  }

  const doctypes = {
    'html5': '<!DOCTYPE html>'
  }

  function doctype () {
    if (accept('doctype')) {
      const id = STATE.current.data
      expect('identifier')
      if (doctypes[id]) {
        emit_line(doctypes[id])
      } else {
        log_error('Uknown Doctype: ' + id, STATE.line)
      }
    }
  }

  function run () {
    next()
    doctype()
    elementlist()
  }

  if (input) {
    scopes.push(input)
    current_depth++
  }

  run()

  if (error) {
    // throw the error maybe
    return undefined
  } else {
    return output
  }
}

module.exports = {
  compile: adomCompile
}