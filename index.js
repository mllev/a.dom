/*************

TERMINALS
identifier . # = [ ] string raw

NONTERMINALS
elementlist element tagdef tag properties innertext idlist

GRAMMAR
elementlist :=
  element elementlist |
  expression elementlist
  empty

expression :=
  each identifier in variable { elementlist } |
  if value compare value { elementlist }

compare :=
  > | < | == | >= | <=

value :=
  string | number | variable

variable :=
  identifier subvariable 

subvariable :=
  [ value ] subvariable |
  . identifier subvariable |
  empty

element :=
  tagdef [ elementlist ] |
  tagdef innertext |
  innertext

innertext :=
  | raw |

tagdef :=
  tag properties

tag :=
  identifier |
  identifier . classlist |
  identifier # idlist

properties :=
  identifier = string properties |
  identifier |
  empty

classlist :=
  identifier . classlist |
  identifier

idlist :=
  identifier # idlist |
  identifier 

*************/

function Compile (prog, input) {
  let i = 0
  let current
  let cache = { type: '', data: '', i: 0 }
  let error = false
  let indents = -1
  let current_classlist = []
  let current_idlist = []
  let iterator
  let output = ''

  function log_error (err) {
    console.log('Error: ' + err)
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
      error = true
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
    let data = input[field]
    expect('identifier')
    expect('[')
    save()
    if (data.forEach !== undefined) {
      data.forEach(function (d) {
        iterator = d
        restore()
        elementlist()
      })
    } else {
      log_error(field + ' is not an array')
      error = true
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
        emit_partial_line('="' + current.data + '"')
        expect('string')
        properties()
      }
    }
  }

  function innertext () {
    if (error) return

    let id = ''
    let start = 0, end = 0
    let data = current.data
    let computed

    for (let i = 0; i < data.length; i++) {
      if (data[i] === '{' && data[i-1] !== '\\') {
        start = i++
        while (data[i] !== '}') {
          id += data[i++]
        }
        end = i++
      }
    }

    if (id.indexOf('.') !== -1) {
      if (typeof iterator !== 'object') {
        log_error(id.split('.')[0].trim() + ' is not an object')
        error = true
        return
      }
      computed = iterator[id.split('.')[1].trim()]
    } else {
      computed = input[id.trim()]
    }

    if (start > 0 && end > 0) {
      data = (data.slice(0, start) + computed + data.slice(end+1, data.length))
    }
    emit_line(data)
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
    while (prog[i] !== del) {
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
      current = {
        type: 'eof',
        data: undefined
      }
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

    current = {
      type: type,
      data: data
    }
  }

  function run () {
    next()
    elementlist()
  }

  run()
  return output
}

module.exports = Compile