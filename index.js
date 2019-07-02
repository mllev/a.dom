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
      tok.type = 'textcontent'
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
  let nodes = []
  let custom_tags = {}
  let root = nodes
  let store_ref = false

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
    if (accept('string') || accept('number')) {
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
    store_ref = true
    tok = tokens[cursor]
    return data[0]
  }

  function get_primitive_or_variable () {
    let val = tok.data
    if (accept('string') || accept('number')) {
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

  function get_attributes () {
    let attr = { events: [] }
    function parse_attributes () {
      let id = tok.data
      if (accept('ident')) {
	if (accept('=')) {
	  if (accept('{')) {
	    if (tok.type === 'string' || tok.type === 'number') {
	      attr[id] = tok.data
	      next()
	    } else if (tok.type === 'ident') {
	      attr[id] = get_variable_access_list()
	      next()
	    }
	    expect('}')
	  } else {
	    attr[id] = tok.data
	    expect('string')
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
	attr.events.push({ type: evt, handler, handler })
	parse_attributes()
      } else if (accept('if')) {
	expect('(')
	let lhs = get_primitive_or_variable()
	let cmp = tok.type
	if (!accept('eq') && !accept('ne') && !accept('le') && !accept('ge') && !accept('gt') && !accept('lt')) {  
	  throw new Error('expected comparison operator')
	}
	let rhs = get_primitive_or_variable()
	attr._if = { lhs: lhs, rhs: rhs, cmp: cmp }
	expect(')')
	parse_attributes()
      } else if (accept('each')) {
	expect('(')
	let it = [tok.data]
	expect('ident')
	if (accept(',')) {
	  it.push(tok.data)
	  expect('ident')
	}
	expect('in')
	let data = get_primitive_or_variable()
	attr._each = { iterator: it, list: data }
	expect(')')
	parse_attributes()
      }
    }
    parse_attributes()
    return attr
  }

  function parse_tag () {
    let node = { type: 'tag', name: tok.data, children: [] }
    expect('ident')
    let class_list = get_class_list()
    let attributes = get_attributes()
    node.attributes = attributes
    node.classes = class_list
    if (accept(';')) {
      node.selfClosing = true
    } else if (accept('[')) {
      let par = root
      root = node.children
      parse_tag_list()
      root = par
      expect(']')
    } else if (tok.type === 'textcontent') {
      for (let i = 0; i < tok.data.length; i++) {
	if (Array.isArray(tok.data[i])) {
	  let toks = tok.data[i]
	  store_ref = true
	  tok.data[i] = __get_variable_access_list(toks, 0)[0]
	}
      }
      node.children.push({
	type: 'textcontent',
	chunks: tok.data,
	store_ref: store_ref
      })
      store_ref = false
      next()
    }
    root.push(node)
  }

  function parse_tag_list () {
    if (accept('doctype')) {
      root.push({ type: 'doctype', doctype: tok.data })
      expect('ident')
      parse_tag_list()
    } if (tok.type === 'ident') {
      parse_tag()
      parse_tag_list()
    } else if (tok.type === 'textcontent') {
      for (let i = 0; i < tok.data.length; i++) {
	if (Array.isArray(tok.data[i])) {
	  let toks = tok.data[i]
	  tok.data[i] = __get_variable_access_list(toks, 0)[0]
	}
      }
      root.push({
	type: 'textcontent',
	chunks: tok.data,
	store_ref: false 
      })
      store_ref = false
      next()
      parse_tag_list()
    } else if (accept('yield')) {
      root.push({ type: 'yield' })
      parse_tag_list()
    }
  }

  function parse_custom_tag () {
    expect('tag')
    let name = tok.data
    let node = { type: 'tag', children: [] }
    expect('ident')
    expect('[')
    let par = root
    root = node.children 
    parse_tag_list()
    root = par
    expect(']')
    custom_tags[name] = node
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
      root.push({ type: 'module', name: name, code: tok.data })
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

  return [nodes, custom_tags]
}

function execute (nodes, custom_tags, _app_state) {
  let current_event_listeners = []
  let modules = {}
  let output = ''
  let indents = 0
  let node_ref = 0
  let runtime = `

${evaluate_condition.toString()}

function get_value(v) {
  if (!Array.isArray(v)) return v
  let idx = adom._state.length - 1
  let check = v[0]
  while (adom._state[idx][check] == null && idx > 0) {
    idx--
  }
  v1 = adom._state[idx]
  for (let i = 0; i < v.length; i++) {
    if (typeof v1[i] !== undefined) {
      v1 = v1[v[i]] 
    } else {
      return undefined
    }
  }
  return v1
}

function update_attributes (el, attr) {
  Object.keys(attr).forEach(function (k) {
    if (Array.isArray(attr[k])) {
      let v = get_value(attr[k])
      if (v !== undefined) {
	el.setAttribute(k, get_value(attr[k]))
      }
    }
  })
}

function update_textcontent (el, chunks) {
  let val = []
  for (let i = 0; i < chunks.length; i++) {
    let v = get_value(chunks[i])
    if (v !== undefined) {
      val.push(v)	
    } else {
      return
    }
  }
  el.textContent = val.join('').trim()
}

function execute_loop (el, node) {
  let arr = get_value(node.each.list)
  let it = node.each.iterator
  let frag = document.createDocumentFragment()
  if (arr.length > 0) 
    el.hidden = false
  arr.forEach(function (i) {
    let e = el.cloneNode(true)
    adom._state.push({ [it]: i })
    update_node(e, node)
    if (node.children)
      update_children(e, node.children)
    frag.append(e)
    adom._state.pop()
  })
  el.replaceWith(frag)
}

function update_node (el, n) {
  if (n.attributes) {
    update_attributes(el, n.attributes)
  }
  if (n.condition) {
    if (evaluate_condition(n.condition)) {
      el.hidden = false
    } else {
      el.hidden = true
    }
  }
  if (n.chunks) {
    update_textcontent(el, n.chunks)
  }
}

function update_children (par, children) {
  children.forEach(function (n) {
    if (n.store_ref !== true) {
      return
    }
    let el = par.querySelector('[data-adom-id="' + n.ref + '"]')
    if (n.each) {
      let elList = par.querySelectorAll('[data-adom-id="' + n.ref + '"]')
      for (let i = 1; i < elList.length; i++) {
	elList[i].parentNode.removeChild(elList[i])
      }
      execute_loop(el, n)
    } else {
      update_node(el, n)
    }
  })
}
`

  function get_indents () {
    let pad = ''
    for (let i = 0; i < indents; i++) {
      pad += '    '
    }
    return pad
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

  function evaluate_condition (condition) {
    let lhs = get_value(condition.lhs)
    let rhs = get_value(condition.rhs)

    switch (condition.cmp) {
      case 'eq':
	if (lhs == rhs) return true
	return false
      case 'ne':
	if (lhs != rhs) return true
	return false
      case 'le':
	if (lhs <= rhs) return true
	return false
      case 'ge':
	if (lhs >= rhs) return true
	return false
      case 'lt':
	if (lhs < rhs) return true
	return false
      case 'gt':
	if (lhs > rhs) return true
	return false
      default:
	break
    }
    return false
  }

  function assemble_textcontent (chunks, ref) {
    if (ref > -1) {
      return '<span data-adom-id="' + ref + '">' + chunks.map(get_value).join('').trim() + '</span>'
    } else {
      return chunks.map(get_value).join('').trim()
    }
  }

  function assemble_attributes (obj) {
    return Object.keys(obj).map(function (k) { return k + '="' + get_value(obj[k]) + '"' }).join(' ')
  }
  
  function print_tag (node, yield_func) {
    output += (get_indents() + '<' + node.name)
    if (node.classes.length > 0) {
      if (node.attributes.class) {
	node.attributes.class = (node.classes.join(' ') + ' ' + node.attributes.class)
      } else {
	node.attributes.class = node.classes.join(' ')
      }
    }
    if (Object.keys(node.attributes).length > 0) {
      output += ' ' + assemble_attributes(node.attributes)
    }
    if (!node.selfClosing) {
      output += node.hidden ? (' hidden>\n') : ('>\n')
      indents++
      walk_node_tree(node.children, yield_func)
      indents--
      output += (get_indents() + '</' + node.name + '>\n')
    } else {
      // make configurable based on doctype
      output += node.hidden ? ' hidden />\n' : ' />\n'
    }
  }

  function create_module (module) {
    let visible_nodes = []
    function get_visible_nodes (nodes) {
      nodes.forEach(function (n) {
	if (n.store_ref)
	  visible_nodes.push(n)
	if (n.children && n.children.length > 0 && !n.each)
	  get_visible_nodes(n.children)
      })
    }
    get_visible_nodes(nodes)
    const indents = get_indents()
    const preamble = '\n' +
      indents + 'let nodes = ' + JSON.stringify(visible_nodes) + '\n' +
      runtime.split('\n').map(function (line) { return indents + line }).join('\n') + '\n' +
      indents + 'let adom = {\n' +
      indents + '\t_state: [' + JSON.stringify(_app_state[0]) + '],\n' +
      indents + '\tupdate: function (obj) {\n' +
      indents + '\t\tObject.assign(adom._state[0], obj)\n' +
      indents + '\t\tupdate_children(document, nodes)\n' +
      indents + '\t}\n' +
      indents + '}\n' +
      indents + 'adom.state = adom._state[0]\n'
    const code = module.code.split('\n').map(function (line) {
      return indents + line
    }).join('\n')

    return indents + '<script>' + preamble + code + '</script>\n'
  }

  function walk_node_tree (tree, yield_func) {
    tree.forEach(function (node) {
      let c = node.children
      if (node.type === 'module') {
	modules[node.name] = node
      } else if (node.type === 'doctype') {
	output += get_indents() + ({
	  html5: '<!DOCTYPE html>'
	}[node.doctype]) + '\n'
      } else if (node.type === 'yield') {
	if (yield_func) {
	  yield_func()
	}	 
      } else if (node.type === 'tag') {
	if (c && c.length === 1 && c[0].type === 'textcontent' && c[0].store_ref) {
	  c[0].is_only_child = true
	  c[0].store_ref = false
	  node.store_ref = true
	  node.chunks = node.children[0].chunks
	}
	if (node.store_ref) {
	  node.ref = node_ref++
	  if (node.attributes) {
	    node.attributes['data-adom-id'] = node.ref
	  } else {
	    node.attributes = { 'data-adom-id': node.ref }
	  }
	}
	if (node.attributes._each) {
	  node.each = node.attributes._each
	  delete node.attributes._each
	}
	if (node.attributes._if) {
	  node.condition = node.attributes._if
	  delete node.attributes._if
	}
	if (node.attributes.events) {
	  node.events = node.attributes.events
	  delete node.attributes.events
	}
	if (node.condition && !evaluate_condition(node.condition)) {
	  node.hidden = true
	}
	let tag_module = undefined
	if (node.events && node.events.length > 0) {
	  node.events.forEach(function (evt) {
	    if (evt.type === 'load') {
	      tag_module = modules[evt.handler]
	    } else {
	      current_event_listeners.push(evt)
	    }
	  })
	}
	if (node.each) {
	  let it = node.each.iterator[0]
	  let obj = get_value(node.each.list)
	  if (!Array.isArray(obj)) {
	    throw new Error('object is not iteratable')
	  }
	  if (obj.length === 0) {
	    node.hidden = true
	    _app_state.push({ [it]: undefined })
	    print_tag(node, yield_func)
	    _app_state.pop()
	    return
	  }
	  obj.forEach(function (o) {
	    if (custom_tags[node.name]) {
	      let props = node.attributes
	      props[it] = o 
	      _app_state.push({ props: props })
	      walk_node_tree(custom_tags[node.name].children, function () {
		_app_state.pop()
		_app_state.push({ [it]: o })
		walk_node_tree(node.children, yield_func)
		_app_state.pop()
		_app_state.push({ props: props })
	      })
	      _app_state.pop()
	    } else {
	      _app_state.push({ [it]: o })
	      print_tag(node, yield_func)
	      _app_state.pop()
	    }
	  })
	  return
	}
	if (custom_tags[node.name]) {
	  _app_state.push({ props: node.attributes })
	  walk_node_tree(custom_tags[node.name].children, function () {
	    walk_node_tree(node.children, yield_func)
	  })
	  _app_state.pop()
	} else {
	  print_tag(node, yield_func)
	}
	if (tag_module) {
	  current_event_listeners = []
	  output += create_module(tag_module)
	}
      } else if (node.type === 'textcontent') {
	output += (get_indents() + assemble_textcontent(node.chunks, (node.store_ref && !node.is_only_child) ? node.ref : -1) + '\n')
      }
    })
  }

  walk_node_tree(nodes)

  return output
}

module.exports = function (input, input_state) {
  let state = [input_state]
  let tokens = tokenize(input, 0, input.length - 1)
  let [nodes, custom_tags] = parse(tokens, state, input)
  let output = execute(nodes, custom_tags, state)

  return output
}

