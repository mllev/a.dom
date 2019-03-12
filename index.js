function Compile (prog, input) {
  let cursor = 0
  let current = { type: '', data: '', line: 0 }
  let file = prog
  let error = false
  let indents = -1
  let current_classlist = []
  let current_idlist = []
  let current_accessorlist = []
  let scalar_value = undefined
  let tags = []
  let scopes = []
  let current_depth = -1
  let output = ''
  let global_print = true
  let global_line = 1

  function log_error (err, line) {
    console.log('Error line ' + line + ': ' + err)
    error = true
  }

  function set_state (state) {
    current.type = state.type || ''
    current.data = state.data || ''
    cursor = state.cursor || 0
    current.line = state.line || 0
    file = state.file || file
  }

  function get_state () {
    return {
      type: current.type,
      data: current.data,
      cursor: cursor,
      line: current.line,
      file: file
    }
  }

  function emit_indents () {
    let space = ''
    for (let i = 0; i < indents; i++) {
      space += '    '
    }
    if (global_print) output += space
  }

  function emit_partial_line (str) {
    if (global_print) output += str
  }

  function emit_line (line) {
    emit_indents()
    emit_partial_line(line)
    emit_partial_line('\n')
  }

  function accept (type) {
    if (error) return
    if (current.type === type) {
      next()
      return true
    } else {
      return false
    }
  }

  function expect (type) {
    if (error) return
    if (current.type !== type) {
      log_error('Unexpected token: ' + current.type, current.line)
    } else {
      next()
    }
  }

  function peek (type) {
    if (error) return
    if (current.type === type) {
      return true
    } else {
      return false
    }
  }

  function elementlist () {
    if (error) return
    if (peek('identifier')) {
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
    } else if (peek('tag')) {
      customtag()
      elementlist()
    } else if (accept('[')) {
      let id = current.data
      expect('identifier')
      let line = current.line
      let state = tags[id]
      if (state) {
        let prev_state = get_state()
        set_state(state)
        customtagbody()
        set_state(prev_state)
        expect(']')
        elementlist()
      } else {
        log_error('Unknown tag: ' + id, line)
        return
      }
    }
  }

  function customtagbody () {
    expect('[')
    elementlist()
    expect(']')
  }

  function customtag () {
    expect('tag')
    let id = current.data
    expect('identifier')
    tags[id] = {
      cursor: cursor,
      data: current.data,
      type: current.type,
      line: current.line
    }
    let scoped_print = global_print
    global_print = false
    customtagbody()
    global_print = scoped_print
  }

  function value () {
    if (peek('identifier')) {
      scalar_value = undefined
      variable()
    } else if (peek('string') || peek('number') || peek('bool')) {
      scalar_value = current.data
      next()
    }
  }

  function ifstatement () {
    if (error) return
    expect('if')
    value()
    let val = compute_value()
    let v1 = {
      type: typeof val,
      data: val
    }
    let should_print = false
    let scoped_print = global_print
    let cmp = current.data
    if (!accept('<=') && !accept('<') && !accept('>=') && !accept('>') && !accept('==')) {
      log_error('Unexpected token ' + current.type, current.line)
      return
    }
    let line = current.line
    value()
    val = compute_value()
    let v2 = {
      type: typeof val,
      data: val
    }
    if (v1.type !== v2.type) {
      log_error('Cannot compare ' + v1.type + ' and ' + v2.type, line)
      return
    }
    if (cmp !== '==' && v1.type !== 'number') {
      log_error('Operator can only be used on numbers', line)
      return
    }
    switch (cmp) {
      case '<=':
        should_print = (v1.data <= v2.data)
        break
      case '<':
        should_print = (v1.data < v2.data)
        break
      case '>=':
        should_print = (v1.data >= v2.data)
        break
      case '>':
        should_print = (v1.data > v2.data)
        break
      case '==':
        should_print = (v1.data == v2.data)
        break
    }
    expect('{')
    // don't accidentally allow printing if the outer conditional is false
    if (scoped_print === true) {
      global_print = should_print
    }
    elementlist()
    expect('}')
    if (accept('else')) {
      if (scoped_print === true) {
        global_print = !should_print
      }
      expect('{')
      elementlist()
      expect('}')
    }
    global_print = scoped_print
  }

  function eachstatement () {
    if (error) return
    expect('each')
    let it = current.data
    expect('identifier')
    expect('in')
    let line = current.line
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
  }

  function element () {
    if (error) return
    indents++
    let id = current.data
    if (accept('identifier')) {
      emit_indents()
      emit_partial_line('<' + id)
      tagdef()
      if (accept('[')) {
        emit_partial_line('>\n')
        elementlist()
        expect(']')
        emit_line('</' + id + '>')
      } else if (accept(';')) {
        emit_partial_line(' />\n')
      } else {
        emit_partial_line('>\n')
        innertext()
        emit_line('</' + id + '>')
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
    if (current_idlist.length > 0) {
      emit_partial_line(' id="' + current_idlist.join(' ') + '"')
      current_idlist = []
    }
    if (current_classlist.length > 0) {
      emit_partial_line(' class="' + current_classlist.join(' ') + '"')
      current_classlist = []
    }
  }

  function properties () {
    if (error) return
    if (peek('identifier')) {
      let id = current.data
      emit_partial_line(' ' + id)
      next()
      if (accept('=')) {
        emit_partial_line('="' + interpolate_values(current.data) + '"')
        expect('string')
        properties()
      }
    }
  }

  function variable () {
    let a = current.data
    expect('identifier')
    scalar_value = undefined
    current_accessorlist.push(a)
    accessor()
  }

  function accessor () {
    if (accept('.')) {
      let a = current.data
      expect('identifier')
      current_accessorlist.push(a)
      accessor()
    } else if (accept('[')) {
      let a = current.data
      if (accept('string') || accept('number')) {
        expect(']')
        current_accessorlist.push(a)
        accessor()
      } else {
        log_error('Unexpected token: ' + current.type)
      }
    }
  }

  function iterate_over_variables (fn) {
    let id = ''
    let start = 0, end = 0
    let data = current.data

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
    current_accessorlist = []
    return val
  }

  function compute_interpolated_value (value) {
    let state = get_state()
    set_state({
      line: current.line,
      file: value
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
    let data = current.data
    emit_line(interpolate_values(data))
    expect('raw')
  }

  function classlist () {
    if (error) return
    current_classlist.push(current.data)
    expect('identifier')
    if (accept('.')) {
      classlist()
    } else if (accept('#')) {
      idlist()
    }
  }

  function idlist () {
    if (error) return
    current_idlist.push(current.data)
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

  function is_sym (c) {
    return c === '[' || c === ']' || c === '.' || c === '#' || c === '(' || c === ')' || c === ';'
  }

  function is_space (c) {
    return c === ' ' || c === '\t' || c === '\r' || c === '\n'
  }

  const keywords = [
    'each',
    'in',
    'if',
    'else',
    'tag'
  ]

  function next () {
    let c, data, type

    while (is_space(file[cursor])) {
      if (file[cursor] === '\n') {
        global_line++
      }
      cursor++
    }
    c = file[cursor]

    if (cursor >= file.length) {
      current.type = 'eof',
      current.data = undefined
      return
    }

    if (c === '=') {
      if (file[cursor+1] === '=') {
        type = '=='
        cursor += 2
        data = type
      } else {
        type = c
        data = c
        cursor++
      }
    } else if (c === '>') {
      if (file[cursor+1] === '=') {
        type = '>='
        cursor += 2
      } else {
        type = '>'
        cursor++
      }
      data = type
    } else if (c === '<') {
      if (file[cursor+1] === '=') {
        type = '<='
        cursor += 2
      } else {
        type = '<'
        cursor++
      }
      data = type
    } else if (is_alpha(c)) {
      type = 'identifier'
      data = identifier(cursor)
      cursor += data.length
    } else if (is_sym(c)) {
      type = c
      data = c
      cursor++
    } else if (c === '"' || c === '\'') {
      type = 'string'
      data = parse_string(cursor)
      cursor += data.length + 2
    } else if (c === '|') {
      cursor++
      type = 'raw'
      data = parse_inner(cursor)
      cursor += data.length + 1
    } else if (is_num(c)) {
      type = 'number'
      data = parse_number(cursor)
      cursor += data.length
      data = parseFloat(data)
    } else {
      type = file[cursor]
      data = file[cursor++]
    }

    if (keywords.indexOf(data) !== -1) {
      type = data
    }

    if (data === 'true' || data === 'false') {
      type = 'bool'
      data = (data === 'true')
    }

    current.type = type
    current.data = data
    current.line = global_line
  }

  function run () {
    next()
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

module.exports = Compile