function Compile (prog, input) {
  let i = 0
  let current = { type: '', data: '', i: 0, line: 0 }
  let cache = { type: '', data: '', i: 0, line: 0 }
  let error = false
  let indents = -1
  let current_classlist = []
  let current_idlist = []
  let scopes = []
  let current_depth = -1
  let output = ''
  let conditionally_print = true
  let global_line = 1

  function log_error (err, line) {
    console.log('Error line ' + line + ': ' + err)
    error = true
  }

  function save () {
    cache.type = current.type
    cache.data = current.data
    cache.i = i
    cache.line = current.line
  }

  function restore () {
    i = cache.i
    current.type = cache.type
    current.data = cache.data
    current.line = cache.line
  }

  function emit_indents () {
    let space = ''
    for (let i = 0; i < indents; i++) {
      space += '    '
    }
    if (conditionally_print) output += space
  }

  function emit_partial_line (str) {
    if (conditionally_print) output += str
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
      log_error('Unexpected token: ' + current.data, current.line)
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
    }
  }

  function value () {
    if (peek('identifier') || peek('string') || peek('number') || peek('bool')) {
      let d = current.data
      next()
      return d
    }
    return undefined
  }

  function ifstatement() {
    if (error) return
    expect('if')
    let v1 = {
      type: current.type,
      data: value()
    }
    let should_print = false
    let scope_print_status = conditionally_print
    let cmp = current.data
    if (!accept('<=') && !accept('<') && !accept('>=') && !accept('>') && !accept('==')) {
      log_error('Unexpected token ' + current.type, current.line)
      return
    }
    let line = current.line
    let v2 = {
      type: current.type,
      data: value()
    }
    if (v1.type !== v2.type) {
      log_error('Cannot compare ' + v1.type + ' and ' + v2.type, line)
      return
    }
    switch (cmp) {
      case '<=':
        if (v1.type !== 'number') {
          log_error('Operator can only be used on numbers', line)
          return
        } else {
          should_print = (v1.data <= v2.data)
        }
        break
      case '<':
        if (v1.type !== 'number') {
          log_error('Operator can only be used on numbers', line)
          return
        } else {
          should_print = (v1.data < v2.data)
        }
        break
      case '>=':
        if (v1.type !== 'number') {
          log_error('Operator can only be used on numbers', line)
          return
        } else {
          should_print = (v1.data >= v2.data)
        }
        break
      case '>':
        if (v1.type !== 'number') {
          log_error('Operator can only be used on numbers', line)
          return
        } else {
          should_print = (v1.data > v2.data)
        }
        break
      case '==':
        should_print = (v1.data == v2.data)
        break
    }
    expect('[')
    // don't accidentally allow printing if the outer conditional is false
    if (scope_print_status === true) {
      conditionally_print = should_print
    }
    elementlist()
    expect(']')
    if (accept('else')) {
      if (scope_print_status === true) {
        conditionally_print = !should_print
      }
      expect('[')
      elementlist()
      expect(']')
    }
    conditionally_print = scope_print_status
  }

  function eachstatement () {
    if (error) return
    expect('each')
    let it = current.data
    expect('identifier')
    expect('in')
    let field = current.data
    let line = current.line
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
      log_error(field + ' is not an array', line)
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
        log_error(field1 + ' is not an object', 'unknown')
        return
      } else {
        computed = ctx[field1][field2]
      }
    } else if (ctx[v]) {
      computed = ctx[v]
    } else {
      log_error('Unknown identifier: ' + v, 'unknown')
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

  // cheating
  function parse_number (i) {
    let num = ''
    let dot_found = false
    while (i < prog.length) {
      if (is_num(prog[i])) {
        num += prog[i]
      } else if (prog[i] === '.' && dot_found === false) {
        num += prog[i]
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
    while (prog[i] !== '|' && i < prog.length) {
      inner += prog[i++]
    }
    return inner
  }

  function is_sym (c) {
    return c === '[' || c === ']' || c === '.' || c == '#'
  }

  function is_space (c) {
    return c === ' ' || c === '\t' || c === '\r' || c === '\n'
  }

  function next () {
    let c, data, type

    while (is_space(prog[i])) {
      if (prog[i] === '\n') {
        global_line++
      }
      i++
    }
    c = prog[i]

    if (i >= prog.length) {
      current.type = 'eof',
      current.data = undefined
      return
    }

    if (c === '=') {
      if (prog[i+1] === '=') {
        type = '=='
        i += 2
        data = type
      } else {
        type = c
        data = c
        i++
      }
    } else if (c === '>') {
      if (prog[i+1] === '=') {
        type = '>='
        i += 2
      } else {
        type = '>'
        i++
      }
      data = type
    } else if (c === '<') {
      if (prog[i+1] === '=') {
        type = '<='
        i += 2
      } else {
        type = '<'
        i++
      }
      data = type
    } else if (is_alpha(c)) {
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
    } else if (is_num(c)) {
      type = 'number'
      data = parse_number(i)
      i += data.length
      data = parseFloat(data)
    } else {
      type = prog[i]
      data = prog[i++]
    }

    if (data === 'each' || data === 'in' || data === 'if' || data === 'else') {
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