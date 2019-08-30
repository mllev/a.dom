function Adom (config) {
  this.cache = config.cache || false
  this.dirname = config.root || ''
  this._cache = {}
  this.files = {}
}

Adom.prototype.tokenize = function (prog, start_pos, end_pos, file) {
  let cursor = start_pos
  let tokens = []

  let keywords = [
    'tag', 'module', 'doctype', 'layout', 'each', 'if', 'in', 'else',
    'import', 'yield', 'on', 'null', 'export', 'file', 'controller', 'and', 'or'
  ]

  let symbols = [
    '.', '#', '=', '[', ']', ';', '{', '}', '(', ')', ':', '$', ',', '>', '<'
  ]

  function break_into_chunks (text, cursor) {
    let chunks = []
    let chunk = ''
    let i = 0, max = text.length
    let in_expr = false
    let pos = cursor
    while (i < max) {
      if (text[i] === '{' && in_expr === false) {
      	in_expr = true
      	chunks.push({ type: 'chunk', data: chunk, pos: pos, file: file })
      	chunk = '{'
      	i++
      	pos = cursor + i
      } else if (text[i] === '}' && in_expr === true) {
      	in_expr = false
      	chunk += '}'
      	let toks = this.tokenize(chunk, 0, chunk.length - 1, file)
      	toks.pop() //eof
      	toks.forEach(function (t) {
      	  t.pos += pos
      	  chunks.push(t)
      	})
      	chunk = ''
      	i++
      	pos = cursor + i + 1
      } else {
	      chunk += text[i++]
      }
    }
    chunks.push({ type: 'chunk', data: chunk, pos: pos, file: file })
    return chunks
  }


  while (true) {
    let c = prog[cursor]
    let tok = { type: '', data: '', pos: cursor, file: file }

    if (cursor > end_pos) {
      tok.type = 'eof'
      tokens.push(tok)
      break
    } else if (c === ' ' || c === '\n' || c === '\t') {
      let i = cursor
      while (i <= end_pos && (prog[i] === ' ' || prog[i] === '\t' || prog[i] === '\n')) {
        i++
      }
      cursor = i
      continue
    } else if (c === '/' && prog[cursor+1] === '/') {
      let i = cursor
      while (c !== '\n' && i <= end_pos)
        c = prog[++i]
      cursor = i
      continue
    } else if (c >= '0' && c <= '9') {
      let neg = tokens[tokens.length - 1].type === '-'
      let num = ''
      let i = cursor
      let dot = false
      while ((c >= '0' && c <= '9') || c === '.') {
        if (c === '.') {
          if (dot) break
          else dot = true
        }
        num += c
        c = prog[++i]
      }
      cursor = i
      tok.type = 'number'
      tok.data = parseFloat(num)
      if (neg) {
        tok.data *= -1
        tokens.pop()
      }
    } else if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) {
      let i = cursor
      tok.data = ''
      while ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '_' || c === '-') {
        tok.data += c
        c = prog[++i]
      }
      cursor = i
      let idx = keywords.indexOf(tok.data)
      if (idx !== -1) {
	      tok.type = keywords[idx]
      } else {
	      tok.type = 'ident'
      }
      if (tok.data === 'true' || tok.data === 'false') {
	      tok.type = 'bool'
        tok.data = (tok.data === 'true')
      }
    } else if (c === '|') {
      let i = cursor + 1
      let text = ''
      while (true) {
        if (i > end_pos) {
          throw { msg: 'unterminated text node', pos: cursor, file: file }
        }

        if (prog[i] === '|') {
          i++
          break
        }
        text += prog[i++]
      }
      let chunks = break_into_chunks.call(this, text, cursor)
      chunks.forEach(function (c) {
	      tokens.push(c)
      })
      cursor = i
      continue
    } else if (c === '<' && prog[cursor+1] === '=') {
      tok.type = '<='
      tok.data = '<='
      cursor += 2
    } else if (c === '>' && prog[cursor+1] === '=') {
      tok.type = '>='
      tok.data = '>='
      cursor += 2
    } else if (c === '=' && prog[cursor+1] === '=') {
      tok.type = '=='
      tok.data = '=='
      cursor += 2
    } else if (c === '!' && prog[cursor+1] === '=') {
      tok.type = '!='
      tok.data = '!='
      cursor += 2
    } else if (symbols.indexOf(c) !== -1) {
      tok.type = c
      tok.data = c
      cursor++
    } else if (c === '"' && prog[cursor+1] === '"' && prog[cursor+2] === '"') {
      let str = ''
      let i = cursor + 3
      while (true) {
        if (i > end_pos) {
          throw { msg: 'unterminated long string', pos: cursor, file: file }
        } else if (prog[i] === '"' && prog[i+1] === '"' && prog[i+2] === '"') {
          i += 3
          break
        }
        str += prog[i++]
      }
      tok.data = str
      tok.type = 'string'
      cursor = i
    } else if (c === '"' || c === '\'') {
      let del = c
      let i = cursor + 1

      while (true) {
        if (i > end_pos || prog[i] === '\n') {
          throw { msg: 'unterminated string', pos: cursor, file: file }
        }
        if (prog[i] === del) {
          i++
          break
        }
        if (prog[i] === '\\' && prog[i+1] === del) {
          tok.data += prog[i+1]
          i += 2
        }
        tok.data += prog[i++]
      }

      tok.type = 'string'
      cursor = i
    } else if (c === '-' && prog[cursor+1] === '-' && prog[cursor+2] === '>') {
      let i = cursor + 3
      while (i <= end_pos) {
        if (prog[i] === '\n' && prog[i+1] === '<' && prog[i+2] === '-' && prog[i+3] === '-') {
          i += 4
          break
        }
        tok.data += prog[i++]
      }
      if (i > end_pos) {
        throw { msg: 'expected closing <--', pos: cursor, file: file }
      }
      cursor = i
      tok.type = 'module_body'
    } else {
      tok.type = tok.data = c
      cursor++
    }
    tokens.push(tok)
  }
  return tokens
}

Adom.prototype.parse = function (tokens) {
  let tok = tokens[0]
  let cursor = 0
  let ops = []
  let current_tag

  function emit (op, data) {
    let i = { op: op }
    if (data) i.data = data
    ops.push(i)
    return ops.length - 1
  }

  function next() {
    tok = tokens[++cursor]
  }

  function expect(t) {
    if (tok.type === t) {
      next()
    } else {
      throw { msg: 'expected: ' + t + ' found: ' + tok.type, pos: tok.pos, file: tok.file }
    }
  }

  function accept(t) {
    if (tok.type === t) {
      next()
      return true
    }
    return false
  }

  function get_right_hand_side () {
    let pos = tok.pos
    if (accept('[')) {
      let arr = []
      if (tok.type !== ']') {
        arr.push(get_right_hand_side())
        while (tok.type === ',') {
          next()
          arr.push(get_right_hand_side())
        }
      }
      expect(']')
      return { type: 'array', value: arr, pos: pos }
    } else {
      return get_primitive_or_variable()
    }
    throw { msg: 'unexpected ' + tok.type, pos: tok.pos, file: tok.file }
  }

  // todo: simplify this - it's from an older design
  function __get_variable_access_list (tokens, cursor) {
    let tok = tokens[cursor]
    let access_list = [tok.data]
    if (tok.type !== 'ident') {
      throw { msg: 'expected identifier', pos: tok.pos, file: tok.file }
    }
    tok = tokens[++cursor]
    function next () {
      if (tok && tok.type === '.') {
        tok = tokens[++cursor]
        if (tok.type !== 'ident') {
          throw { msg: 'expected identifier', pos: tok.pos, file: tok.file }
        }
        access_list.push(tok.data)
        tok = tokens[++cursor]
        next()
      } else if (tok && tok.type === '[') {
        tok = tokens[++cursor]
        if (tok.type !== 'number' && tok.type !== 'string') {
          throw { msg: 'cannot be used to index array', pos: tok.pos, file: tok.file }
        }
        access_list.push(tok.data)
        tok = tokens[++cursor]
        if (tok.type !== ']') {
          throw { msg: 'expected ]', pos: tok.pos, file: tok.file }
        }
        tok = tokens[++cursor]
        next()
      }
    }
    next()
    return [access_list, cursor]
  }

  function get_variable_access_list () {
    let pos = tok.pos
    let file = tok.file
    let data = __get_variable_access_list(tokens, cursor)
    cursor = data[1]
    tok = tokens[cursor]
    return { type: 'variable', value: data[0], pos: pos, file: file }
  }

  function get_primitive_or_variable () {
    let val = tok.data
    let pos = tok.pos
    let type = tok.type
    let file = tok.file
    if (accept('number') || accept('bool') || accept('string')) {
      return { type: type, value: val, pos: pos, file: file }
    } else if (tok.type === 'ident') {
      return get_variable_access_list()
    } else {
      throw { msg: 'unexpected ' + tok.type, pos: pos, file: tok.file }
    }
  }

  function get_class_list () {
    let class_list = []
    function parse_classes () {
      if (accept('.')) {
        class_list.push(tok.data)
        expect('ident')
        parse_classes()
      }
    }
    parse_classes()
    return class_list
  }

  function get_attributes () {
    let events = []
    let attr = {}
    let controller = undefined
    function parse_attributes () {
      let id = tok.data
      if (accept('ident')) {
        if (accept('=')) {
          if (accept('{')) {
            attr[id] = get_primitive_or_variable()
            expect('}')
          } else if (tok.type === 'string') {
            attr[id] = { type: 'string', value: tok.data, pos: tok.pos, file: tok.file }
            next()
          } else {
            throw { msg: 'unexpected ' + tok.type, pos: tok.pos, file: tok.file }
          }
        } else {
          attr[id] = { type: 'bool', value: true }
        }
        parse_attributes()
      } else if (accept('on')) {
        expect(':')
        let evt = tok.data
        expect('ident')
        expect('(')
        let handler = tok.data
        expect('ident')
        expect(')')
        events.push({ type: evt, handler, handler })
        parse_attributes()
      } else if (accept('controller')) {
        expect('(')
        controller = tok.data
        expect('ident')
        expect(')')
        parse_attributes()
      }
    }
    parse_attributes()
    return [attr, events, controller]
  }

  function get_textnode () {
    let t = []
    function parse_textnode () {
      t.push({ type: 'chunk', value: tok.data, pos: tok.pos, file: tok.file })
      expect('chunk')
      if (accept('{')) {
        t.push(get_variable_access_list())
        expect('}')
        parse_textnode()
      }
    }
    parse_textnode()
    return t
  }

  function parse_tag () {
    let node = { tagname: tok.data }
    expect('ident')
    let class_list = get_class_list()
    let attr_data = get_attributes()
    node.attributes = attr_data[0]
    node.events = attr_data[1]
    node.controller = attr_data[2]
    if (class_list.length > 0) {
      if (!node.attributes.class) {
        node.attributes.class = { type: 'string', value: class_list.join(' ') }
      }
    }
    if (accept(';')) {
      node.self_close = true
      emit('tag_begin', node)
    } else if (accept('[')) {
      emit('tag_begin', node)
      let pos = ops.length - 1
      parse_tag_list()
      expect(']')
      emit('tag_end', node.tagname)
      ops[pos].data.jump = ops.length - pos
    } else if (tok.type === 'chunk') {
      emit('tag_begin', node)
      let pos = ops.length - 1
      emit('textnode', get_textnode())
      emit('tag_end', node.tagname)
      ops[pos].data.jump = ops.length - pos
    } else {
      throw { msg: 'unexpected ' + tok.type, pos: tok.pos, file: tok.file }
    }
  }

  function parse_if_statement () {
    expect('(')
    let lhs = get_primitive_or_variable()
    let cmp = tok.type
    if (!accept('==') && !accept('!=') && !accept('<=') && !accept('>=') && !accept('>') && !accept('<')) {
      throw { msg: 'expected comparison operator', pos: tok.pos, file: tok.file }
    }
    let rhs = get_primitive_or_variable()
    let _if = { lhs: lhs, rhs: rhs, cmp: cmp }
    expect(')')
    let ifpos = emit('jump_if', { condition: _if })
    if (accept('[')) {
      parse_tag_list()
      expect(']')
    } else {
      parse_tag()
    }
    let jmppos = emit('jump')
    emit('end_if')
    ops[ifpos].data.jump = ops.length - ifpos
    if (accept('else')) {
      if (accept('[')) {
        parse_tag_list()
        expect(']')
      } else if (accept('if')) {
        parse_if_statement()
      } else {
        parse_tag()
      }
    }
    emit('end_else')
    ops[jmppos].data = ops.length - jmppos
  }

  function parse_tag_list () {
    if (accept('doctype')) {
      emit('doctype', tok.data)
      expect('ident')
      parse_tag_list()
    } else if (accept('if')) {
      parse_if_statement()
      parse_tag_list()
    } else if (accept('each')) {
      expect('(')
      let it = [tok.data]
      expect('ident')
      if (accept(',')) {
        it.push(tok.data)
        expect('ident')
      }
      expect('in')
      let data = get_variable_access_list()
      let _each = { iterator: it, list: data }
      emit('begin_each', { condition: _each })
      let pos = ops.length - 1
      expect(')')
      expect('[')
      parse_tag_list()
      expect(']')
      emit('iterate')
      ops[pos].data.jump = ops.length - pos
      parse_tag_list()
    } else if (tok.type === 'ident') {
      parse_tag()
      parse_tag_list()
    } else if (tok.type === 'chunk') {
      emit('textnode', get_textnode())
      parse_tag_list()
    } else if (accept('yield')) {
      emit('yield', current_tag)
      parse_tag_list()
    }
  }

  function parse_custom_tag () {
    expect('tag')
    let name = tok.data
    let p = tok.pos
    expect('ident')
    emit('custom_tag', { name: name, pos: p })
    let pos = ops.length - 1
    expect('[')
    current_tag = name
    parse_tag()
    current_tag = undefined
    expect(']')
    emit('custom_tag_return', name)
    ops[pos].data.jump = ops.length - pos
  }

  function parse_file () {
    if (tok.type === 'eof') {
      return
    } else if (accept('import')) {
      let f = tok.data
      let p = tok.pos
      expect('string')
      emit('import', { file: f, pos: p })
      parse_file()
    } else if (accept('export')) {
      let s = tok.data
      let p = tok.pos
      let f = tok.file
      expect('ident')
      emit('export', { name: s, pos: p, file: f })
      parse_file()
    } else if (tok.type === 'ident' || tok.type === 'doctype') {
      parse_tag_list()
      parse_file()
    } else if (tok.type === 'tag') {
      parse_custom_tag()
      parse_file()
    } else if (accept('$')) {
      let variable = get_variable_access_list()
      expect('=')
      if (accept('file')) {
        let f = tok.data
        let p = tok.pos
        expect('string')
        emit('set', { key: variable, value: { type: 'file', value: f, pos: p }})
        parse_file()
      } else {
        emit('set', { key: variable, value: get_right_hand_side(), })
        parse_file()
      }
    } else if (accept('module')) {
      let name = tok.data
      let p = tok.pos
      expect('ident')
      let body = tok.data
      expect('module_body')
      emit('module', { name: name, body: body, pos: p })
      parse_file()
    } else {
      throw { msg: 'unexpected: ' + tok.type, pos: tok.pos, file: tok.file }
    }
  }

  parse_file()

  return ops
}

Adom.prototype.expand_custom_tags = function (ops) {
  let ptr = 0
  let tags = {}
  let new_ops = []
  let jumps = []

  while (ptr < ops.length) {
    let op = ops[ptr++]
    // relies on switch fallthrough
    switch (op.op) {
      case 'begin_each':
        new_ops.push(op)
        jumps.push({ op: new_ops.length - 1 })
        break
      case 'iterate':
        new_ops.push(op)
        let j = jumps.pop()
        new_ops[j.op].data.jump = new_ops.length - j.op
        break
      case 'jump_if':
        new_ops.push(op)
        jumps.push({ op: new_ops.length - 1 })
        break
      case 'jump':
        new_ops.push(op)
        jumps.push({ op: new_ops.length - 1 })
        break
      case 'end_if': {
        new_ops.push(op)
        let j = jumps.pop()
        new_ops[j.op].data.jump = new_ops.length - j.op
      } break
      case 'end_else': {
        new_ops.push(op)
        let j = jumps.pop()
        new_ops[j.op].data = new_ops.length - j.op
      } break
      case 'yield':
        let tmp = tags[op.data][1]
        if (tmp != null) {
          tags[op.data][2] = ptr
          ptr = tmp
        }
        break
      case 'custom_tag':
        tags[op.data.name] = [ptr]
        ptr += op.data.jump - 1
        break
      case 'custom_tag_return':
        ptr = tags[op.data][3]
        new_ops.push({ op: 'pop_props' })
        break
      case 'tag_begin':
        let name = op.data.tagname
        if (tags[name]) {
          new_ops.push({ op: 'push_props', data: op.data.attributes })
          if (op.data.self_close) {
            tags[name][3] = ptr
          } else {
            tags[name][1] = ptr
            tags[name][3] = ptr + op.data.jump - 1
          }
          ptr = tags[name][0]
          break
        }
      case 'tag_end':
        if (tags[op.data.name]) {
          ptr = tags[op.data.name][2]
          break
        }
      default:
        new_ops.push(op)
        break
    }
  }

  return new_ops
}

Adom.prototype.execute = function (ops, _app_state) {
  let doctype_map = {
    'html5': '<!DOCTYPE html>'
  }

  function update_app_state (accessor, val, pos, file) {
    let ptr = _app_state[0]
    let max = accessor.length
    let prev = undefined

    for (let i = 0; i < max; i++) {
      let a = accessor[i]
      let t = typeof ptr[a]

      if (Array.isArray(ptr) && typeof a === 'string') {
	      throw { msg: prev + ' is an array', pos: pos, file: file }
      }

      if (i === max - 1) {
        ptr[a] = val
        return
      }

      if (t === 'string' || t === 'number') {
	      throw { msg: a + ' is a ' + t + ' and cannot be accessed like an array or object', pos: pos, file: file }
      }

      if (ptr[a] == null) {
        if (typeof accessor[i+1] === 'number') {
          ptr[a] = []
        } else {
          ptr[a] = {}
        }
      }

      ptr = ptr[a]
      prev = a
    }
  }

  function get_value(vlist, pos, file) {
    let idx = _app_state.length - 1
    let check = vlist[0]
    while (_app_state[idx][check] == null && idx > 0) {
      idx--
    }
    v1 = _app_state[idx]
    let prev = check
    vlist.forEach(function (v, i) {
      if (v1[v] != null) {
	      v1 = v1[v]
      } else {
        if (i > 0) {
	        throw { msg: v + ' is not a property of ' + vlist[i-1], pos: pos, file: file }
        } else {
          throw { msg: v + ' is not defined', pos: pos, file: file }
        }
      }
      prev = v
    })
    return v1
  }

  function resolve_value (v) {
    switch (v.type) {
      case 'string':
      case 'number':
      case 'bool':
	      return v.value
        break
      case 'variable':
	      return get_value(v.value, v.pos, v.file)
        break
      case 'array':
	      return v.value.map(resolve_value)
        break
    }
  }

  function evaluate_condition (condition) {
    let lhs = resolve_value(condition.lhs)
    let rhs = resolve_value(condition.rhs)
    let cmp = condition.cmp

    if (cmp === '==' && lhs == rhs) return true
    if (cmp === '!=' && lhs != rhs) return true
    if (cmp === '<=' && lhs <= rhs) return true
    if (cmp === '>=' && lhs >= rhs) return true
    if (cmp === '<'  && lhs <  rhs) return true
    if (cmp === '>'  && lhs >  rhs) return true

    return false
  }

  function get_attribute_string (attr) {
    let a = ''
    let keys = Object.keys(attr)
    keys.forEach(function (k, i) {
      a += k + '="' + resolve_value(attr[k]) + '"'
      if (i < keys.length - 1) a += ' '
    })
    return a
  }

  function get_attribute_data (attr) {
    let a = {}
    Object.keys(attr).forEach(function (k) {
      a[k] = resolve_value(attr[k])
    })
    return a
  }

  function get_textnode_string (chunks) {
    let t = ''
    chunks.forEach(function (c) {
      if (c.type === 'chunk') t += c.value
      else t += resolve_value(c)
    })
    return t.trim()
  }

  function exec () {
    let output = ''
    let ptr = 0
    let loops = []

    while (ptr < ops.length) {
      let op = ops[ptr++]
      switch (op.op) {
        case 'push_props':
          _app_state.push({ props: get_attribute_data(op.data) })
          break
        case 'pop_props':
          _app_state.pop()
          break
        case 'set':
          let acc = op.data.key.value
          let val = resolve_value(op.data.value)
          update_app_state(acc, val, op.data.key.pos, op.data.key.file)
          break
        case 'tag_begin':
          let name = op.data.tagname
          let a = get_attribute_string(op.data.attributes)
          if (op.data.module) {
            output += ('<script>' + op.data.module[0] + JSON.stringify(_app_state[0]) + op.data.module[1] + '</script>')
          }
          output += '<' + name + (a ? (' ' + a) : '')
          if (op.data.self_close) output += ' />'
          else output += '>'
          break
        case 'tag_end':
          output += '</' + op.data + '>'
          break
        case 'textnode':
          output += get_textnode_string(op.data)
          break
        case 'jump':
          ptr += op.data - 1
          break
        case 'jump_if':
          let jmp = !evaluate_condition(op.data.condition)
          if (jmp) ptr += op.data.jump - 1
          break
        case 'begin_each':
          let iter0 = op.data.condition.iterator[0]
          let iter1 = op.data.condition.iterator[1]
          let list = resolve_value(op.data.condition.list)
          if (list.length === 0) {
            ptr += op.data.jump
            break
          }
          loops.push({
            i: 0,
            iterator: op.data.condition.iterator,
            list: list,
            start: ptr
          })
          _app_state.push({ [iter0]: list[0], [iter1]: 0 })
          break
        case 'iterate':
          let max = _app_state.length - 1
          let loop = loops[loops.length-1]
          if (loop.i < loop.list.length - 1) {
            loop.i++
            _app_state[max][loop.iterator[0]] = loop.list[loop.i]
            _app_state[max][loop.iterator[1]] = loop.i
            ptr = loop.start
          } else {
            loops.pop()
            _app_state.pop()
          }
          break
        default:
          break
      }
    }

    return output
  }

  return exec()
}

Adom.prototype.resolve_imports_and_exports = function (ops) {
  let ptr = 0
  let custom_tags = {}
  let modules = {}
  let current = null
  let exp = []

  while (ptr < ops.length) {
    let op = ops[ptr++]
    switch (op.op) {
      case 'import':
        let new_ops = []
        let file, data = op.data
        try {
          file = this.files[this.loadFile(data.file)]
        } catch (e) {
          e.pos = data.pos
          throw e
        }
        let output = this.compile_to_ir(file, data.file)
        output.exports.forEach(function (e) {
          if (e.type === 'custom_tag') {
            for (let i = e.data.start; i <= e.data.end; i++) {
              new_ops.push(output.opcodes[i])
            }
          } else if (e.type === 'module') {
            new_ops.push({ op: 'module', data: e.data })
          }
        })
        ptr--
        ops.splice(ptr, 1, ...new_ops)
        break
      case 'set':
        if (op.data.value.type === 'file') {
          let f = this.loadFile(op.data.value.value)
          op.data.value.type = 'string'
          op.data.value.value = this.files[f]
        }
        break
      case 'module':
        modules[op.data.name] = {
          type: 'module',
          data: {
            name: op.data.name,
            body: op.data.body,
            pos: op.data.pos
          }
        }
        break
      case 'custom_tag':
        current = custom_tags[op.data.name] = {
          type: 'custom_tag',
          data: { start: ptr - 1 }
        }
        break
      case 'custom_tag_return':
	      current.data.end = ptr - 1
	      break
      case 'export':
        let e = op.data
        let tag = custom_tags[e.name]
        let mod = modules[e.name]

        if (tag && mod) throw { msg: e.name + ' is ambiguous.', pos: e.pos, file: e.file }
        if (!tag && !mod) throw { msg: e.name + ' is not defined.', pos: e.pos, file: e.file }

        exp.push(tag || mod)
        break
      default:
	      break
    }
  }

  return {
    opcodes: ops,
    exports: exp
  }
}

Adom.prototype.get_error_text = function (prog, c) {
  let i = c
  let buf = '', pad = '    '
  let pos = c
  let line = 1
  while (pos >= 0) if (prog[pos--] === '\n') line++
  buf += line + '| '
  let np = line.toString().length + 2
  for (let k = 0; k < np; k++) pad += ' '
  while (prog[i-1] !== '\n' && i > 0) i--
  while (prog[i] !== '\n' && i < prog.length) {
    if (i < c) {
      if (prog[i] === '\t') pad += '\t'
      else pad += ' '
    }
    buf += prog[i++]
  }
  buf += ('\n' + pad + '^\n')
  return buf
}

Adom.prototype.runtime = function (config) {
  return [`
// name, state, rootNode, nodeTree, events, module
window.addEventListener('load', function ${config.name} () {
  // create node tree from state
  var $$adom_state = `,`
  var $$adom_props = []
  var $$adom_events = undefined
  var $$adom_prev_tree = undefined

  function $$adom_flatten (arr) {
    let nodes = []
    arr.forEach(function (c) {
      if (Array.isArray(c)) {
        c.forEach(function (i) {
          nodes.push(i)
        })
      } else if (c) {
        nodes.push(c)
      }
    })
    return nodes
  }

  function $$adom_push_props (obj) {
    $$adom_props.push(obj)
    return null
  }

  function $$adom_pop_props () {
    $$adom_props.pop()
    return null
  }

  function $$adom_element (type, attr, children) {
    if (type === 'textnode') {
      return { type: type, content: attr }
    }
    let c = children ? $$adom_flatten(children) : undefined
    return { type: type, attributes: attr, children: c }
  }

  function $$adom_select (sel) {
    return document.querySelectorAll(sel)
  }

  function $$adom_attach_event (e) {
    $$adom_select(e.sel).forEach(function (el) {
      el.addEventListener(e.event, e.handler)
    })
  }

  function $$adom_each (list, children) {
    let nodes = []

    list.forEach(function (item, i) {
      nodes = nodes.concat($$adom_flatten(children(item, i)))
    })

    return nodes
  }

  function $$adom_if (cond, children) {
    if (cond) {
      return $$adom_flatten(children)
    } else {
      return null
    }
  }

  function $$adom_set_event_listeners (events) {
    if ($$adom_events) {
      $$adom_events.forEach($$adom_attach_event)
    } else {
      $$adom_events = events
      $$adom_events.forEach($$adom_attach_event)
    }
  }

  function $$adom_create_node (node) {
    if (node.type === 'textnode') {
      let c = node.content.trim()
      if (c) {
        let t = document.createElement('div')
        t.innerHTML = c
        return t.childNodes[0]
      }
      return document.createTextNode('')
    }
    let el = document.createElement(node.type)
    Object.keys(node.attributes).forEach(function (attr) {
      el.setAttribute(attr, node.attributes[attr])
    })
    return el
  }

  function $$adom_create_dom_tree (nodes) {
    let rootNode = document.createDocumentFragment()
    function walk (children) {
      let prev
      children.forEach(function (node) {
        let el = $$adom_create_node(node)
        if (node.children) {
          prev = rootNode
          rootNode = el
          walk(node.children)
          rootNode = prev
        }
        rootNode.appendChild(el)
      })
    }
    walk(nodes)
    return rootNode
  }

  function $$adom_update (state) {
    let root_node = $$adom_select('[data-adom-id="${config.root}"]')[0]
    let nodes = $$adom_create_node_tree()
    console.log($$adom_prev_tree)
    root_node.innerHTML = ''
    root_node.appendChild($$adom_create_dom_tree(nodes))
    $$adom_prev_tree = nodes
    $$adom_set_event_listeners()
  }

  function $$adom_create_node_tree () {
    return $$adom_flatten([
      ${config.nodes}
    ])
  }

  (function ($, $update) {
    $$adom_prev_tree = $$adom_create_node_tree()
    $$adom_set_event_listeners(${config.events});
    ${config.module}
  })($$adom_state, $$adom_update)
})
  `]
}

Adom.prototype.resolve_modules = function (ops) {
  let ptr = 0
  let controllers = {}
  let ids = 0
  let tags = []
  let in_controller = false
  let controller = undefined
  let node_tree = ''
  let events = []
  let prop_depth = -1
  let iterators = []

  function is_iterator (v) {
     for (let i = 0; i < iterators.length; i++) {
       if (iterators[i].indexOf(v) !== -1) {
         return true
       }
     }
     return false
  }

  function get_value (v) {
    switch (v.type) {
      case 'chunk':
      case 'string':
        return '"' + v.value + '"'
      case 'number':
        return v.value
      case 'variable':
        let start = 0
        let val = v.value
        let variable = '$$adom_state.'
        if (is_iterator(val[0])) {
          variable = ''
        } else if (val[0] === 'props') {
          variable = '$$adom_props[' + prop_depth + ']'
          start = 1
        }
        for (let i = start; i < val.length; i++) {
          let part = val[i]
          if (i === 0) variable += part
          else if (typeof part === 'number') variable += '[' + part + ']'
          else variable += '["' + part + '"]'
        }
        return variable
      default:
        return '""'
    }
  }

  function get_content (chunks) {
    let text = ''
    chunks.forEach(function (chunk, i) {
      text += get_value(chunk)
      if (i < chunks.length - 1) text += ' + '
    })
    return text
  }

  function stringify_object (obj) {
    let o = ''
    let keys = Object.keys(obj)
    keys.forEach(function (k, i) {
      o += ('"' + k + '": ' + get_value(obj[k]))
      if (i < keys.length - 1) o += ', '
    })
    return '{' + o + '}'
  }

  while (ptr < ops.length) {
    let op = ops[ptr++]
    switch (op.op) {
      case 'push_props':
        if (in_controller) {
          node_tree += '$$adom_push_props(' + stringify_object(op.data) + '),'
          prop_depth++
        }
        break
      case 'pop_props':
        if (in_controller) {
          node_tree += '$$adom_pop_props(),'
          prop_depth--
        }
        break
      case 'tag_begin':
        if (controllers[op.data.controller]) {
          if (in_controller) {
            throw { msg: 'cannot have nested controllers' }
          }
          if (!op.data.self_close) {
            let id = ids++
            controller = {
              body: controllers[op.data.controller],
              ptr: ptr-1,
              root: id,
              name: op.data.controller
            }
            in_controller = true
            tags.push(op.data.tagname)
          }
        } else if (in_controller) {
          if (op.data.events.length > 0) {
            let id = ids++
            op.data.attributes['data-adom-id'] = { type: 'number', value: id }
            op.data.events.forEach(function (e) {
              events.push({ sel: '[data-adom-id="' + id + '"]', event: e.type, handler: e.handler })
            })
          }
          let attr = stringify_object(op.data.attributes)
          if (op.data.self_close) {
            node_tree += '$$adom_element("' + op.data.tagname + '", ' + attr + '),'
          } else {
            node_tree += '$$adom_element("' + op.data.tagname + '", ' + attr + ', ['
            tags.push(op.data.tagname)
          }
        }
        break
      case 'tag_end':
        if (in_controller) {
          tags.pop()
          if (tags.length === 0) {
            let o = ops[controller.ptr]
            let evtstr = ''
            events.forEach(function (e) {
              evtstr += '{sel: \'' + e.sel + '\', event: \'' + e.event + '\', handler: ' + e.handler + '},'
            })
            o.data.attributes['data-adom-id'] = { type: 'number', value: controller.root }
            o.data.module = this.runtime({
              nodes: node_tree,
              name: controller.name,
              root: controller.root,
              module: controller.body,
              events: '[' + evtstr + ']'
            })
            controller = undefined
            in_controller = false
            node_tree = ''
          } else {
            node_tree += ']),'
          }
        }
        break
      case 'textnode':
        if (in_controller) {
          node_tree += '$$adom_element("textnode", ' + get_content(op.data) + '),'
        }
        break
      case 'module':
        controllers[op.data.name] = op.data.body
        break
      case 'begin_each': {
        let c = op.data.condition
        if (c.iterator.length > 1) {
          node_tree += '$$adom_each(' + get_value(c.list) + ', function(' + c.iterator[0] + ', ' + c.iterator[1] + '){ return ['
        } else {
          node_tree += '$$adom_each(' + get_value(c.list) + ', function(' + c.iterator[0] + '){ return ['
        }
        iterators.push(c.iterator)
      } break
      case 'iterate':
        node_tree += ']; }),'
        iterators.pop()
        break
      case 'jump_if': {
        let c = op.data.condition
        node_tree += '$$adom_if(' + get_value(c.lhs) + c.cmp + get_value(c.rhs) + ', ['
      } break
      case 'end_if':
        node_tree += ']),'
        break
      default:
        break
    }
  }

  return ops
}

Adom.prototype.compile_to_ir = function (prog, file) {
  let tokens = this.tokenize(prog, 0, prog.length - 1, file)
  let ops = this.parse(tokens)
  return this.resolve_imports_and_exports(ops)
}

Adom.prototype.compile_string = function (prog, file, input_state) {
  let opcodes = this.compile_to_ir(prog, file).opcodes
  console.log(opcodes)
  opcodes = this.expand_custom_tags(opcodes)
  console.log(opcodes)
  opcodes = this.resolve_modules(opcodes)
  return this.execute(opcodes, [input_state])
}

Adom.prototype.loadFile = function (file) {
  let fs = require('fs')
  let path = require('path')
  let f = path.resolve(this.dirname, file)
  if (this.files[f]) {
    return f
  }
  try {
    this.files[f] = fs.readFileSync(f).toString()
  } catch (e) {
    throw { msg: 'error opening file ' + f }
  }
  return f
}

Adom.prototype.compile_file = function (file, input_state) {
  try {
    let c = this.loadFile(file)
    if (this.cache) {
      let ops = this._cache[c]
      if (!ops) {
        ops = this.compile_to_ir(this.files[c], c).opcodes
        ops = this.expand_custom_tags(ops)
        this._cache[c] = this.resolve_modules(ops)
      }
      return this.execute(ops, [input_state])
    } else {
      let f = this.files[c]
      let html = this.compile_string(f, c, input_state)
      this.files = {}
      return html
    }
  } catch (e) {
    if (e.pos) {
      console.log('Error: ', e.file)
      console.log('  ' + e.msg)
      console.log('    ' + this.get_error_text(this.files[e.file], e.pos))
    } else if (e.msg) {
      console.log(e.msg)
    } else {
      console.log(e)
    }
    this.files = {}
    this._cache = {}
    return ''
  }
}

module.exports = Adom
