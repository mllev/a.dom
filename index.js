function Compile (prog, input) {
  let i = 0
  let current = { type: '', data: '', i: 0 }
  let cache = { type: '', data: '', i: 0 }
  let error = false
  let indents = -1
  let current_classlist = []
  let current_idlist = []
  let scopes = []
  let current_depth = -1
  let output = ''

  function log_error (err) {
    console.log('Error: ' + err)
    error = true
  }

  function save () {
    cache.type = current.type
    cache.data = current.data
    cache.i = i
  }

  function restore () {
    i = cache.i
    current.type = cache.type
    current.data = cache.data
  }

  function emit_indents () {
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
    emit_partial_line(line + '\n')
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
      log_error('Unexpected token: ', current.data)
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
    }
  }

  function eachstatement () {
    if (error) return
    expect('each')
    let it = current.data
    expect('identifier')
    expect('in')
    let field = current.data
    let data = compute_value(field)
    expect('identifier')
    expect('[')
    save()
    if (data.forEach !== undefined) {
      data.forEach(function (d) {
        scopes.push({ [it]: d })
        current_depth++
        restore()
        elementlist()
        current_depth--
        scopes.pop()
      })
    } else {
      log_error(field + ' is not an array')
      return
    }
    expect(']')
  }

  function element () {
    if (error) return
    indents++
    if (peek('identifier')) {
      let id = current.data
      emit_indents()
      emit_partial_line('<' + id)
      tagdef()
      emit_partial_line('>\n')
      if (accept('[')) {
        elementlist()
        expect(']')
      } else {
        innertext()
      }
      emit_line('</' + id + '>')
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
    expect('identifier')
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

  function compute_value (value) {
    let computed
    let v = value.trim()
    let ctx = scopes[current_depth]
    if (value.indexOf('.') !== -1) {
      let parts = v.split('.')
      let field1 = parts[0].trim()
      let field2 = parts[1].trim()

      if (typeof ctx[field1] !== 'object') {
        log_error(field1 + ' is not an object')
        return
      } else {
        computed = ctx[field1][field2]
      }
    } else if (ctx[v]) {
      computed = ctx[v]
    } else {
      log_error('Unknown identifier: ' + v)
      return
    }
    return computed
  }

  function replace_values (data, values) {
    let outp = ''
    let start_index = 0

    for (let i = 0; i < values.length; i++) {
      let end_index = values[i].start_index - 2
      let v = compute_value(values[i].variable)
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
    while (is_alpha(prog[i]) || is_num(prog[i]) || prog[i] === '_' || prog[i] === '-') {
      id += prog[i++]
    }
    return id
  }

  function parse_string (i) {
    let str = ''
    let del = prog[i++]
    while (prog[i] !== del && i < prog.length) {
      if (prog[i] === '\\') {
        str += prog[++i]
      } else {
        str += prog[i]
      }
      i++
    }
    return str
  }

  function parse_inner (i) {
    let inner = ''
    while (prog[i] !== '|' && i < prog.length) {
      inner += prog[i++]
    }
    return inner
  }

  function is_sym (c) {
    return c === '[' || c === ']' || c === '.' || c == '#' || c === '='
  }

  function is_space (c) {
    return c === ' ' || c === '\t' || c === '\r' || c === '\n'
  }

  function next () {
    let c, data, type

    while (is_space(prog[i])) i++
    c = prog[i]

    if (i >= prog.length) {
      current.type = 'eof',
      current.data = undefined
      return
    }

    if (is_alpha(c)) {
      type = 'identifier'
      data = identifier(i)
      i += data.length
    } else if (is_sym(c)) {
      type = c
      data = c
      i++
    } else if (c === '"' || c === '\'') {
      type = 'string'
      data = parse_string(i)
      i += data.length + 2
    } else if (c === '|') {
      i++
      type = 'raw'
      data = parse_inner(i)
      i += data.length + 1
    } else {
      type = 'unknown'
      data = prog[i++]
    }

    if (data === 'each' || data === 'in') {
      type = data
    }

    current.type = type
    current.data = data
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
  return output
}

module.exports = Compile