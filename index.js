const fs = require('fs')

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


function tokenize (prog, start_pos, end_pos) {
  let cursor = start_pos
  let tokens = []

  const keywords = [
    'tag', 'module', 'doctype', 'layout', 'each', 'if', 'in', 'import', 'data', 'yield',
    'eq', 'ne', 'lt', 'gt', 'ge', 'le', 'on', 'null'
  ]

  const symbols = [
    '.', '#', '=', '[', ']', ';', '{', '}', '(', ')', ':', '$', ','
  ]

  function break_into_chunks (text) {
    let chunks = []
    let chunk = ''
    let i = 0, max = text.length
    let in_expr = false
    while (i < max) {
      if (text[i] === '{' && in_expr === false) {
	in_expr = true
	chunks.push(chunk)
	chunk = ''
	i++ 
      } else if (text[i] === '}' && in_expr === true) {
	in_expr = false
	let toks = tokenize(chunk, 0, chunk.length - 1)
	toks.pop() //eof
	chunks.push(toks)
	chunk = ''
	i++
      } else {
	chunk += text[i++]
      }
    }
    chunks.push(chunk)
    return chunks
  }


  while (true) {
    let c = prog[cursor]
    let tok = { data: '', pos: cursor }

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
	  throw new Error('unterminated text content')
	}
	if (prog[i] === '|') {
	  i++
	  break
	}
	text += prog[i++]
      }
      tok.type = 'textnode'
      tok.data = break_into_chunks(text) 
      cursor = i
    } else if (symbols.indexOf(c) !== -1) {
      tok.type = c
      tok.data = c
      cursor++
    } else if (c === '"' && prog[cursor+1] === '"' && prog[cursor+2]) {
      let str = ''
      let i = cursor + 3
      while (true) {
	if (i > end_pos) {
	  throw new Error('unterminated long string')
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
	  throw new Error('unterminated string')
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
      tok.data = break_into_chunks(tok.data)
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
	throw new Error('expected closing <--')
      }
      cursor = i
      tok.type = 'module_body'
    } else {
      cursor++
    }
    tokens.push(tok)
  }
  return tokens
}

function parse (tokens, _app_state, input_program) {
  let tok = tokens[0]
  let cursor = 0
  let ops = []

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
      throw new Error('expected: ' + t + ' found: ' + tok.type)
    }
  }

  function accept(t) {
    if (tok.type === t) {
      next()
      return true
    }
    return false
  }

  function update_app_state (accessor, val) {
    let ptr = _app_state[0]
    let max = accessor.length

    for (let i = 0; i < max; i++) {
      let a = accessor[i]
      let t = typeof ptr[a]

      if (i === max - 1) {
	ptr[a] = val
	return
      }

      if (t === 'string' || t === 'number') {
	throw new error(a + ' is a ' + t + ' and cannot be accessed like an array or object')
      }

      if (ptr[a] == null) {
	if (typeof accessor[i+1] === 'number')
	  ptr[a] = []
	else
	  ptr[a] = {}
      }
  
      ptr = ptr[a]
    }
  }

  function get_array_or_primitive () {
    let val = tok.data
    if (accept('string') || accept('number') || accept('bool')) {
      return val
    }
    if (accept('[')) {
      let arr = []
      if (tok.type !== ']') {
	arr.push(get_array_or_primitive())
	while (tok.type === ',') {
	  next()
	  arr.push(get_array_or_primitive())
	}
      }
      expect(']')
      return arr
    }
    throw new Error('unexpected ' + tok.type)
  }

  function __get_variable_access_list (tokens, cursor) {
    let tok = tokens[cursor]
    let access_list = [tok.data]
    if (tok.type !== 'ident') {
      throw new Error('expected identifier')
    }
    tok = tokens[++cursor]
    function next () {
      if (tok && tok.type === '.') {
	tok = tokens[++cursor]
	if (tok.type !== 'ident') {
	  throw new Error('expected identifier')
	}
	access_list.push(tok.data)
	tok = tokens[++cursor]
	next()
      } else if (tok && tok.type === '[') {
	tok = tokens[++cursor]
	access_list.push(tok.data)
	if (tok.type !== 'number' && tok.type !== 'string') {
	  throw new Error('Cannot index array using value')
	}
	tok = tokens[++cursor]
	if (tok.type !== ']') {
	  throw new Error('expected ]')
	}
	tok = tokens[++cursor]
	next() 
      }
    }
    next()
    return [access_list, cursor]
  }

  function get_variable_access_list () {
    const data = __get_variable_access_list(tokens, cursor)
    cursor = data[1]
    tok = tokens[cursor]
    return data[0]
  }

  function get_primitive_or_variable () {
    let val = tok.data
    if (accept('string') || accept('number') || accept('bool')) {
      return val 
    } else if (tok.type === 'ident') {
      return get_variable_access_list()
    } else {
      throw new Error('unexpected ' + tok.type)
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

  function parse_chunks (c) {
    let chunks = []
    for (let i = 0; i < c.length; i++) {
      if (Array.isArray(c[i])) {
	chunks.push(__get_variable_access_list(c[i], 0)[0])
      } else {
	chunks.push(c[i])
      }
    }
    return chunks
  }

  function get_attributes () {
    let events = []
    let attr = {}
    function parse_attributes () {
      let id = tok.data
      if (accept('ident')) {
	if (accept('=')) {
	  if (accept('{')) {
	    if (tok.type === 'ident') {
	      attr[id] = [get_variable_access_list()]
	    } else {
	      throw new Error('unexpected ' + tok.type)
	    }
	    expect('}')
	  } else if (tok.type === 'string') {
	    attr[id] = parse_chunks(tok.data)
	    next()
	  } else {
	    throw new Error('unexpected ' + tok.type)
	  }
	} else {
	  attr[id] = true
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

  function parse_tag () {
    let node = { tagname: tok.data }
    expect('ident')
    let class_list = get_class_list()
    let attr_data = get_attributes()
    node.attributes = attr_data[0]
    node.events = attr_data[1]
    if (accept(';')) {
      emit('tag_self_close', node)
    } else if (accept('[')) {
      emit('tag_begin', node)
      parse_tag_list()
      expect(']')
      emit('tag_end', node.tagname)
    } else if (tok.type === 'textnode') {
      emit('tag_begin', node)
      emit('textnode', parse_chunks(tok.data))
      emit('tag_end', node.tagname)
      next()
    } else {
      throw new Error('unexpected ' + tok.type)
    }
  }

  function parse_tag_list () {
    if (accept('doctype')) {
      expect('ident')
      parse_tag_list()
    } else if (accept('if')) {
      expect('(')
      let lhs
      if (tok.type === 'ident') {
	lhs = [get_primitive_or_variable()]
      } else {
	lhs = get_primitive_or_variable()
	if (Array.isArray(lhs)) lhs = parse_chunks(lhs)
      }
      let cmp = tok.type
      if (!accept('eq') && !accept('ne') && !accept('le') && !accept('ge') && !accept('gt') && !accept('lt')) {  
	throw new Error('expected comparison operator')
      }
      let rhs
      if (tok.type === 'ident') {
	rhs = [get_primitive_or_variable()]
      } else {
	rhs = get_primitive_or_variable()
	if (Array.isArray(rhs)) rhs = parse_chunks(rhs)
      }
      let _if = { lhs: lhs, rhs: rhs, cmp: cmp }
      expect(')')
      emit('jump_if', { condition: _if })
      let ins = ops.length - 1
      expect('[')
      parse_tag_list()
      expect(']')
      ops[ins].data.position = ops.length - 1
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
      emit('each', { condition: _each })
      let ins = ops.length - 1
      expect(')')
      expect('[')
      parse_tag_list()
      expect(']')
      ops[ins].data.position = ops.length - 1
      parse_tag_list()
    } else if (tok.type === 'ident') {
      parse_tag()
      parse_tag_list()
    } else if (tok.type === 'textnode') {
      tok.data = parse_chunks(tok.data)
      next()
      parse_tag_list()
    } else if (accept('yield')) {
      parse_tag_list()
    }
  }

  function parse_custom_tag () {
    expect('tag')
    let name = tok.data
    expect('ident')
    emit('custom_tag_begin', name)
    expect('[')
    parse_tag()
    expect(']')
    emit('custom_tag_end', name)
  }

  function parse_file () {
    if (tok.type === 'eof') {
      return
    } else if (tok.type === 'ident' || tok.type === 'doctype') {
      parse_tag_list()
      parse_file()
    } else if (tok.type === 'tag') {
      parse_custom_tag()
      parse_file()
    } else if (accept('$')) {
      let variable = get_variable_access_list()
      expect('=')
      update_app_state(variable, get_array_or_primitive())
      parse_file()
    } else if (accept('module')) {
      let name = tok.data
      expect('ident')
      expect('module_body')
      parse_file()
    } else {
      throw new Error('unexpected: ' + tok.type)
    }
  }
  
  try {
    parse_file()
  } catch (e) {
    console.log(e.toString())
    console.log(get_error_text(input_program, tok.pos))
  }

  return ops
}

function execute (ops, _app_state) {
  const doctype_map = {
    'html5': '<!DOCTYPE html>'
  }

  function get_value(v) {
    if (!Array.isArray(v)) return v
    let idx = _app_state.length - 1
    let check = v[0]
    while (_app_state[idx][check] == null && idx > 0) {
      idx--
    }
    v1 = _app_state[idx]
    v.forEach(function (i) {
      v1 = v1[i]
    })
    return v1
  }

  function assemble_chunks (chunks) {
    if (!Array.isArray(chunks)) return chunks
    return chunks.map(get_value).join('').trim()
  }

  function assemble_attributes (obj) {
    return Object.keys(obj).map(function (k) { return k + '="' + assemble_chunks(obj[k]) + '"' }).join(' ')
  }

  function evaluate_condition (condition) {
    let lhs = assemble_chunks(condition.lhs)
    let rhs = assemble_chunks(condition.rhs)
    let cmp = condition.cmp

    if (cmp === 'eq' && lhs == rhs) return true
    if (cmp === 'ne' && lhs != rhs) return true
    if (cmp === 'le' && lhs <= rhs) return true
    if (cmp === 'ge' && lhs >= rhs) return true
    if (cmp === 'lt' && lhs <  rhs) return true
    if (cmp === 'gt' && lhs >  rhs) return true
    
    return false
  }

  function exec () {
    let output = ''
    let ptr = 0

    while (true) {
      let op = ops[ptr++]
      switch (op.op) {
	case 'tag_begin':
	  let n = op.data.tagname
	  let a = assemble_attributes(op.data.attributes)
	  a = a ? (' ' + a) : ''
	  output += '<' + n + a + '>'
	  break
	case 'tag_end':
	  output += '</' + op.data + '>'
	  break
	case 'textnode':
	  output += assemble_chunks(op.data)
	  break
	case 'jump_if':
	  let jmp = !evaluate_condition(op.data.condition)
	  if (jmp) ptr = op.data.position
	  break
	case 'each':
	  let iter0 = op.data.condition.iterator[0]
	  let iter1 = op.data.condition.iterator[1]
	  let list = get_value(op.data.condition.list)
	  console.log(iter0, list)
	  break
	default:
	  break
      }
      if (ptr >= ops.length) {
	break
      }
    }

    return output
  }

  return exec()
}

module.exports = function (input, input_state) {
  let state = [input_state]
  let tokens = tokenize(input, 0, input.length - 1)
  let ops = parse(tokens, state, input)
  console.log(JSON.stringify(ops, null, 2))
  let output = execute(ops, state)

  console.log(output)

  return output
}

