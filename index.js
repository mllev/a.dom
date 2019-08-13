function tokenize (prog, start_pos, end_pos) {
  let cursor = start_pos
  let tokens = []

  const keywords = [
    'tag', 'module', 'doctype', 'layout', 'each', 'if', 'in', 'import', 'data', 'yield', 'on', 'null', 'export', 'file'
  ]

  const symbols = [
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
	chunks.push({ type: 'chunk', data: chunk, pos: pos })
	chunk = '{'
	i++
	pos = cursor + i
      } else if (text[i] === '}' && in_expr === true) {
	in_expr = false
	chunk += '}'
	let toks = tokenize(chunk, 0, chunk.length - 1)
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
    chunks.push({ type: 'chunk', data: chunk, pos: pos })
    return chunks
  }


  while (true) {
    let c = prog[cursor]
    let tok = { type: '', data: '', pos: cursor }

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
	  throw { msg: 'unterminated text node', pos: cursor }
	}
	
	if (prog[i] === '|') {
	  i++
	  break
	}
	text += prog[i++]
      }
      let chunks = break_into_chunks(text, cursor)
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
	  throw { msg: 'unterminated long string', pos: cursor }
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
      const del = c
      let i = cursor + 1

      while (true) {
	if (i > end_pos || prog[i] === '\n') {
	  throw { msg: 'unterminated string', pos: cursor }
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
	throw { msg: 'expected closing <--', pos: cursor }
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

function parse (tokens) {
  let tok = tokens[0]
  let cursor = 0
  let ops = []
  let current_tag

  function emit (op, data) {
    let i = { op: op }
    if (data) i.data = data
    ops.push(i)
  }

  function next() {
    tok = tokens[++cursor]
  }

  function expect(t) {
    if (tok.type === t) {
      next()
    } else {
      throw { msg: 'expected: ' + t + ' found: ' + tok.type, pos: tok.pos }
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
    throw { msg: 'unexpected ' + tok.type, pos: tok.pos }
  }

  function __get_variable_access_list (tokens, cursor) {
    let tok = tokens[cursor]
    let access_list = [tok.data]
    if (tok.type !== 'ident') {
      throw { msg: 'expected identifier', pos: tok.pos }
    }
    tok = tokens[++cursor]
    function next () {
      if (tok && tok.type === '.') {
	tok = tokens[++cursor]
	if (tok.type !== 'ident') {
	  throw { msg: 'expected identifier', pos: tok.pos }
	}
	access_list.push(tok.data)
	tok = tokens[++cursor]
	next()
      } else if (tok && tok.type === '[') {
	tok = tokens[++cursor]
	if (tok.type !== 'number' && tok.type !== 'string') {
	  throw { msg: 'cannot be used to index array', pos: tok.pos }
	}
	access_list.push(tok.data)
	tok = tokens[++cursor]
	if (tok.type !== ']') {
	  throw { msg: 'expected ]', pos: tok.pos }
	}
	tok = tokens[++cursor]
	next() 
      }
    }
    next()
    return [access_list, cursor]
  }

  function get_variable_access_list () {
    const pos = tok.pos
    const data = __get_variable_access_list(tokens, cursor)
    cursor = data[1]
    tok = tokens[cursor]
    return { type: 'variable', value: data[0], pos: pos }
  }

  function get_primitive_or_variable () {
    const val = tok.data
    const pos = tok.pos
    const type = tok.type
    if (accept('number') || accept('bool') || accept('string')) {
      return { type: type, value: val, pos: pos }
    } else if (tok.type === 'ident') {
      return get_variable_access_list()
    } else {
      throw { msg: 'unexpected ' + tok.type, pos: pos }
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
    function parse_attributes () {
      let id = tok.data
      if (accept('ident')) {
	if (accept('=')) {
	  if (accept('{')) {
	    attr[id] = get_primitive_or_variable()
	    expect('}')
	  } else if (tok.type === 'string') {
	    attr[id] = { type: 'string', value: tok.data, pos: tok.pos }
	    next()
	  } else {
	    throw { msg: 'unexpected ' + tok.type, pos: tok,pos }
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
      }
    }
    parse_attributes()
    return [attr, events]
  }

  function get_textnode () {
    let t = []
    function parse_textnode () {
      t.push({ type: 'chunk', value: tok.data, pos: tok.pos })
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
      throw { msg: 'unexpected ' + tok.type, pos: tok.pos }
    }
  }

  function parse_tag_list () {
    if (accept('doctype')) {
      emit('doctype', tok.data)
      expect('ident')
      parse_tag_list()
    } else if (accept('if')) {
      expect('(')
      let lhs = get_primitive_or_variable()
      let cmp = tok.type
      if (!accept('==') && !accept('!=') && !accept('<=') && !accept('>=') && !accept('>') && !accept('<')) {  
	throw { msg: 'expected comparison operator', pos: tok.pos }
      }
      let rhs = get_primitive_or_variable()
      let _if = { lhs: lhs, rhs: rhs, cmp: cmp }
      expect(')')
      emit('jump_if', { condition: _if })
      let pos = ops.length - 1
      expect('[')
      parse_tag_list()
      expect(']')
      ops[pos].data.jump = ops.length - pos
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
      let ins = ops.length - 1
      expect(')')
      expect('[')
      parse_tag_list()
      expect(']')
      emit('iterate')
      parse_tag_list()
    } else if (tok.type === 'ident') {
      parse_tag()
      parse_tag_list()
    } else if (tok.type === 'chunk') {
      emit('tag_begin', node)
      emit('textnode', get_textnode())
      emit('tag_end', node.tagname)
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
      expect('ident')
      emit('export', { name: s, pos: p })
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
	emit('set', { key: variable, value: get_right_hand_side() })
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
      throw { msg: 'unexpected: ' + tok.type, pos: tok.pos }
    }
  }
  
  parse_file()

  return ops
}

function execute (ops, _app_state) {
  const doctype_map = {
    'html5': '<!DOCTYPE html>'
  }

  function update_app_state (accessor, val) {
    let ptr = _app_state[0]
    let max = accessor.length
    let prev = undefined

    for (let i = 0; i < max; i++) {
      let a = accessor[i]
      let t = typeof ptr[a]

      if (Array.isArray(ptr) && typeof a === 'string') {
	throw new Error(prev + ' is an array')
      }

      if (i === max - 1) {
	ptr[a] = val
	return
      }

      if (t === 'string' || t === 'number') {
	throw new Error(a + ' is a ' + t + ' and cannot be accessed like an array or object')
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

  function get_value(v, pos) {
    let idx = _app_state.length - 1
    let check = v[0]
    while (_app_state[idx][check] == null && idx > 0) {
      idx--
    }
    v1 = _app_state[idx]
    let prev = check
    v.forEach(function (i) {
      if (v1[i] != null) {
	v1 = v1[i]
      } else {
	throw { msg: i + ' is not a property', pos: pos }
      }
      prev = i
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
	return get_value(v.value, v.pos)
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
    let tags = {}
    let current_tag = undefined

    while (ptr < ops.length) {
      let op = ops[ptr++]
  
      switch (op.op) {
	case 'yield':
	  let tmp = tags[op.data].jump1
	  if (tmp != null) {
	    tags[op.data].jump2 = ptr
	    ptr = tmp
	  }
	  break
	case 'custom_tag':
	  tags[op.data.name] = { jump0: ptr }
	  ptr += op.data.jump - 1
	  break
	case 'custom_tag_return':
	  ptr = tags[op.data].jump3
	  break
	case 'set':
	  const acc = op.data.key.value
	  const val = resolve_value(op.data.value)
	  update_app_state(acc, val)
	  break
	case 'tag_begin':
	  const name = op.data.tagname
	  if (tags[name]) {
	    const a = get_attribute_data(op.data.attributes)
	    _app_state.push({ props: a })
	    if (op.data.self_close) {
	      tags[name].jump3 = ptr
	    } else {
	      tags[name].jump1 = ptr
	      tags[name].jump3 = ptr + op.data.jump - 1
	    }
	    ptr = tags[name].jump0
	  } else {
	    const a = get_attribute_string(op.data.attributes)
	    output += '<' + name + ' ' + a
	    if (op.data.self_close) output += ' />'
	    else output += '>'
	  }
	  break
	case 'tag_end':
	  if (tags[op.data]) {
	    ptr = tags[op.data].jump2 
	  } else {
	    output += '</' + op.data + '>'
	  }
	  break
	case 'textnode':
	  output += get_textnode_string(op.data)
	  break
	case 'jump_if':
	  let jmp = !evaluate_condition(op.data.condition)
	  if (jmp) ptr += op.data.jump - 1
	  break
	case 'begin_each':
	  let iter0 = op.data.condition.iterator[0]
	  let iter1 = op.data.condition.iterator[1]
	  let list = resolve_value(op.data.condition.list)
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

function resolve_imports_and_exports (ops) {
  let fs = require('fs')
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
	  file = fs.readFileSync(data.file).toString()
	} catch (e) {
	  throw { msg: 'error loading file', pos: data.pos }
	}
	let output = compile_to_ir(file)
	output.exports.forEach(function (e) {
	  if (e.type === 'custom_tag') {
	    for (let i = e.data.start; i <= e.data.end; i++) {
	      new_ops.push(output.opcodes[i])
	    }
	  } else if (e.type === 'module') {
	    new_ops.push({ op: 'module', data: e.data })
	  }
	})
	ops.splice(ptr, 0, ...new_ops)
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

	if (tag && mod) throw { msg: e.name + ' is ambiguous.', pos: e.pos }
	if (!tag && !mod) throw { msg: e.name + ' is not defined.', pos: e.pos }

	if (tag) exp.push(tag)
	if (mod) exp.push({ type: 'module', data: mod })
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

function get_error_text (prog, c) {
  let i = c
  let buf = '', pad = ''
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

function compile_to_ir (prog) {
  let tokens = tokenize(prog, 0, prog.length - 1)
  let ops = parse(tokens)

  return resolve_imports_and_exports(ops)
}

function compile_string (prog, input_state) {
  opcodes = compile_to_ir(prog).opcodes
  return execute(opcodes, [state])
}

function Adom (config) {
  this.cache = config.cache
  this.dirname = config.root
  this._cache = {}
}

Adom.prototype.compile_file = function (file, input_state) {
  let str, fs = require('fs')
  try {
    if (this.cache) {
      if (this._cache[file]) {
	str = this._cache[file].contents
	return execute(this._cache[file].opcodes, [input_state])
      } else {
	str = fs.readFileSync(file).toString()
	opcodes = compile_to_ir(str).opcodes
	this._cache[file] = { opcodes: opcodes, contents: str }
	return execute(opcodes, [input_state])
      }
    } else {
      str = fs.readFileSync(file).toString()
      return compile_string(str, input_state)
    }
  } catch (e) {
    console.log(e.msg)
    console.log(get_error_text(str, e.pos))
    return ''
  }
}

module.exports = Adom

