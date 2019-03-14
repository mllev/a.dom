function Compile (prog, input) {
  let cursor = 0
  let current = { type: '', data: '', line: 0 }
  let file = prog
  let error = false
  let indents = -1
  let current_classlist = []
  let current_idlist = []
  let current_accessorlist = []
  let current_arglist = []
  let scalar_value = undefined
  let tags = []
  let scopes = []
  let current_depth = -1
  let output = ''
  let global_print = true
  let global_line = 1

  /* vm */
  let constants = []
  let opcodes = []

  const OP_BEGIN_TAG = 0
  const OP_END_TAG = 1
  const OP_END_VOID_TAG = 2
  const OP_CLASSLIST_RESET = 3
  const OP_IDLIST_RESET = 4
  const OP_CLASS = 5
  const OP_ID = 6
  const OP_DOCTYPE_HTML5 = 7
  const OP_BEGIN_TAG_END = 8
  const OP_INNERTEXT = 9

  function emit_partial_line (str) {
    if (global_print) output += str
  }

  function emit_line (line) {
    emit_indents()
    emit_partial_line(line)
    emit_partial_line('\n')
  }


  function execute ()
  {
    for (let i = 0; i < opcodes.length; i++) {
      let op = opcodes[i]
      switch (op[0]) {
        case OP_BEGIN_TAG: {
          indents++
          emit_indents()
          emit_partial_line('<' + constants[op[1]])
        } break;
        case OP_BEGIN_TAG_END: {
          emit_partial_line('>\n')
        } break;
        case OP_END_TAG: {
          emit_line('</' + constants[op[1]] + '>')
          indents--
        } break;
        case OP_END_VOID_TAG: {
          emit_partial_line(' />\n')
          indents--
        } break;
        case OP_CLASSLIST_RESET: {
          if (current_classlist.length > 0) {
            emit_partial_line(' class="' + current_classlist.join(' ') + '"')
            current_classlist = []
          }
        } break;
        case OP_IDLIST_RESET: {
          if (current_idlist.length > 0) {
            emit_partial_line(' id="' + current_idlist.join(' ') + '"')
            current_idlist = []
          }
        } break;
        case OP_CLASS: {
          current_classlist.push(constants[op[1]])
        } break;
        case OP_ID: {
          current_idlist.push(constants[op[1]])
        } break;
        case OP_DOCTYPE_HTML5: {
          emit_line('<!DOCTYPE html>')
        } break;
      }
    }
  }
  /**/

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

  function emit_opcode (c, data) {
    if (data !== undefined) {
      opcodes.push([c, data])
    } else {
      opcodes.push([c])
    }
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
      valuelist()
      expect(']')
      elementlist()
    }
  }

  function customtagbody () {
    expect('[')
    elementlist()
    expect(']')
  }

  function arglist () {
    if (accept('identifier')) {
      arglist()
    }
  }

  function customtag () {
    expect('tag')
    let id = current.data
    expect('identifier')
    arglist()
    customtagbody()
  }

  function value () {
    if (peek('identifier')) {
      variable()
    } else if (peek('string') || peek('number') || peek('bool')) {
      next()
    }
  }

  function valuelist () {
    if (peek('identifier') || peek('string') || peek('number') || peek('bool')) {
      value()
      valuelist()
    }
  }

  function ifstatement () {
    if (error) return
    expect('if')
    value()
    if (!accept('<=') && !accept('<') && !accept('>=') && !accept('>') && !accept('==')) {
      log_error('Unexpected token ' + current.type, current.line)
      return
    }
    let line = current.line
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

  function eachstatement () {
    if (error) return
    expect('each')
    let it = current.data
    expect('identifier')
    expect('in')
    let line = current.line
    variable()
    expect('{')
    elementlist()
    expect('}')
  }

  function element () {
    if (error) return
    let id = current.data
    if (accept('identifier')) {
      constants.push(id)
      let const_id = constants.length - 1
      emit_opcode(OP_BEGIN_TAG, const_id)
      tagdef()
      if (accept('[')) {
        emit_opcode(OP_BEGIN_TAG_END)
        elementlist()
        expect(']')
        emit_opcode(OP_END_TAG, const_id)
      } else if (accept(';')) {
        emit_opcode(OP_END_VOID_TAG)
      } else {
        emit_opcode(OP_BEGIN_TAG_END)
        innertext()
        emit_opcode(OP_END_TAG, const_id)
      }
    } else {
      innertext()
    }
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
      emit_opcode(OP_CLASSLIST_RESET)
    } else if (accept('#')) {
      idlist()
      emit_opcode(OP_IDLIST_RESET)
    }
  }

  function properties () {
    if (error) return
    if (peek('identifier')) {
      let id = current.data
      next()
      if (accept('=')) {
        expect('string')
        properties()
      }
    }
  }

  function variable () {
    let a = current.data
    expect('identifier')
    accessor()
  }

  function accessor () {
    if (accept('.')) {
      let a = current.data
      expect('identifier')
      accessor()
    } else if (accept('[')) {
      let a = current.data
      if (accept('string') || accept('number')) {
        expect(']')
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
      current_accessorlist = []
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
      current_accessorlist = []
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
    constants.push(data)
    emit_opcode(OP_INNERTEXT)
    expect('raw')
  }

  function classlist () {
    if (error) return
    constants.push(current.data)
    emit_opcode(OP_CLASS, constants.length - 1)
    expect('identifier')
    if (accept('.')) {
      classlist()
    } else if (accept('#')) {
      idlist()
    }
  }

  function idlist () {
    if (error) return
    constants.push(current.data, constants.length - 1)
    emit_opcode(OP_ID)
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
    'tag',
    'doctype',
    'html5'
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

  function doctype () {
    if (accept('doctype')) {
      expect('html5')
      emit_line('<!DOCTYPE html>')
      emit_opcode(OP_DOCTYPE_HTML5)
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

  output = ''
  execute()

  if (error) {
    // throw the error maybe
    return undefined
  } else {
    return output
  }
}

module.exports = Compile