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
  let modules = {}
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
    let control = {}
    let events = []
    let attr = {}
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
	events.push({ type: evt, handler, handler })
	parse_attributes()
      } else if (accept('if')) {
	expect('(')
	let lhs = get_primitive_or_variable()
	let cmp = tok.type
	if (!accept('eq') && !accept('ne') && !accept('le') && !accept('ge') && !accept('gt') && !accept('lt')) {  
	  throw new Error('expected comparison operator')
	}
	let rhs = get_primitive_or_variable()
	control._if = { lhs: lhs, rhs: rhs, cmp: cmp }
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
	control._each = { iterator: it, list: data }
	expect(')')
	parse_attributes()
      }
    }
    parse_attributes()
    return [attr, control, events]
  }

  function parse_tag () {
    let node = { type: 'tag', name: tok.data, children: [] }
    expect('ident')
    let class_list = get_class_list()
    let attr_data = get_attributes()
    node.attributes = attr_data[0]
    node.control = attr_data[1]
    node.events = attr_data[2]
    /*
    if (class_list > 0) {
      if (node.attributes.class) {
	node.attributes.class = (node.classes.join(' ') + ' ' + node.attributes.class)
      } else {
	node.attributes.class = node.classes.join(' ')
      }
    }
    */
    node.classes = class_list
    if (accept(';')) {
      node.selfClosing = true
    } else if (accept('[')) {
      let par = root
      root = node.children
      parse_tag_list()
      root = par
      expect(']')
    } else if (tok.type === 'textnode') {
      for (let i = 0; i < tok.data.length; i++) {
	if (Array.isArray(tok.data[i])) {
	  let toks = tok.data[i]
	  tok.data[i] = __get_variable_access_list(toks, 0)[0]
	}
      }
      node.children.push({
	type: 'textnode',
	chunks: tok.data
      })
      next()
    } else {
      throw new Error('unexpected ' + tok.type)
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
    } else if (tok.type === 'textnode') {
      let ref = false
      for (let i = 0; i < tok.data.length; i++) {
	if (Array.isArray(tok.data[i])) {
	  let toks = tok.data[i]
	  tok.data[i] = __get_variable_access_list(toks, 0)[0]
	}
      }
      root.push({
	type: 'textnode',
	chunks: tok.data
      })
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
      modules[name] = tok.data
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

  return [nodes, custom_tags, modules]
}

function expand_custom_tags (nodes, custom_tags, _app_state) {
  const resolved = []
  let root = resolved

  function walk_nodes (nodes, yield_func) {
    nodes.forEach(function (node) {
      if (node.type === 'yield') {
	if (yield_func) {
	  yield_func()
	}
      } else if (node.type === 'tag' && custom_tags[node.name]) {
	let custom_tag = custom_tags[node.name]
	root.push({ type: 'push_props', scope: node.attributes })
	walk_nodes(custom_tag.children, function () {
	  root.push({ type: 'pop_props' })
	  walk_nodes(node.children, yield_func)
	  root.push({ type: 'push_props', scope: node.attributes })
	})
	root.push({ type: 'pop_props' })
      } else if (node.type === 'tag') {
	let r = root
	let children = node.children
	node.children = []
	root.push(node)
	if (children) {
	  root = node.children
	  walk_nodes(children, yield_func)
	}
	root = r
      } else if (node.type === 'textnode' || node.type === 'doctype') {
	root.push(node)
      }
    })
  }

  walk_nodes(nodes, undefined)

  return resolved
}

function attach_modules (nodes, modules, _app_state) {
  let node_map = {}

  function store_ref (n, node, id, attributes, textnodes) {
    node.attributes['data-adom-id'] = id
    n.id = id
    n.attributes = attributes || []
    n.textnodes = textnodes || []
    node_map[id] = node
  }

  function find_refs (nodes) {
    let refs = []
    let root = refs
    let ref = 0
    function walk_nodes(nodes, par) {
      nodes.forEach(function (node) {
	let n = { id: -1, children: [] }
	if (node.type === 'pop_props') {
	  root.push(node) 
	} else if (node.type === 'push_props') {
	  root.push(node)
	} else if (node.type === 'tag') {
	  if (node.events.length > 0) {
	    n.events = node.events
	    store_ref(n, node, ref++)
	  } else {
	    let textnodes = []
	    let attr = {}
	    let _if = node.control._if
	    let _each = node.control._each

	    for (let i in node.attributes) {
	      if (Array.isArray(node.attributes[i])) {
		attr[i] = node.attributes[i]
	      }
	    }

	    for (let i = 0; i < node.children.length; i++) {
	      const n = node.children[i]
	      if (n.type === 'textnode') {
		for (let j in n.chunks) {
		  if (Array.isArray(n.chunks[j])) {
		    textnodes.push({ index: i, chunks: n.chunks })
		    break
		  }
		}
	      }
	    }
  
	    if (Object.keys(attr).length || textnodes.length || _if || _each) {
	      n.name = node.name
	      n._if = _if || {}
	      n._each = _each || {}
	      store_ref(n, node, ref++, attr, textnodes)
	    }
	  }
	  let current_root = root
	  if (n.id !== -1) {
	    root.push(n)
	    root = n.children
	  }
	  if (node.children) {
	    walk_nodes(node.children, node)
	  }
	  root = current_root
	}
      })
    }
    walk_nodes(nodes)
    return refs
  }

  function find_module_roots (refs) {
    let module_roots = []
    function walk_nodes (refs) {
      refs.forEach(function (ref) {
	if (ref.events) {
	  ref.events.forEach(function (e) {
	    if (e.type === 'load') {
	      module_roots.push({ name: e.handler, node: ref }) 
	    }
	  })
	} 
	if (ref.children && ref.children.length > 0) {
	  walk_nodes(ref.children)
	}
      })
    }
    walk_nodes(refs)
    return module_roots
  }

  function find_events (refs) {
    let events = []
    function walk_nodes (refs) {
      refs.forEach(function (ref) {
	if (ref.events) {
	  ref.events.forEach(function (e) {
	    events.push({ event: e, node: ref })
	  })
	  delete ref.events
	} 
	if (ref.children && ref.children.length > 0) {
	  walk_nodes(ref.children)
	}
      })
    }
    walk_nodes(refs)
    return events
  }
  
  let refs = find_refs(nodes)
  let module_roots = find_module_roots(refs)
  
  function runtime (root) {
    return `
const __adom_refs = ${JSON.stringify(root)}
const __adom_state = [${JSON.stringify(_app_state[0])}]
const $ = __adom_state[0]

function $select (sel) {
  return document.querySelector(sel)
}

function $selectAll (sel) {
  return document.querySelectorAll(sel) 
}

function $attach (e, sel, handler) {
  $selectAll(sel).forEach(function (el) {
    el.addEventListener(e, handler)
  })
}

function __get_value(v) {
  if (!Array.isArray(v)) return v
  let idx = __adom_state.length - 1
  let check = v[0]
  while (__adom_state[idx][check] == null && idx > 0) {
    idx--
  }
  v1 = __adom_state[idx]
  v.forEach(function (i) {
    v1 = v1[i]
  })
  return v1
}

function __evaluate_condition (condition) {
  let lhs = __get_value(condition.lhs)
  let rhs = __get_value(condition.rhs)
  let cmp = condition.cmp

  if (cmp === 'eq' && lhs == rhs) return true
  if (cmp === 'ne' && lhs != rhs) return true
  if (cmp === 'le' && lhs <= rhs) return true
  if (cmp === 'ge' && lhs >= rhs) return true
  if (cmp === 'lt' && lhs <  rhs) return true
  if (cmp === 'gt' && lhs >  rhs) return true
  
  return false
}

function __assemble_textnode (chunks) {
  return chunks.map(__get_value).join('').trim()
}

function __update_node (el, node) {
  if (node._if && node._if.cmp && !__evaluate_condition(node._if)) {
    el.hidden = true
    return 
  } else {
    el.hidden = false
  }
  for (a in node.attributes) {
    el[a] = __get_value(node.attributes[a])
  }
  for (let i = 0; i < node.textnodes.length; i++) {
    const tn = node.textnodes[i]
    el.childNodes[tn.index].textContent = __assemble_textnode(tn.chunks)
  }
}

function $update () {
  function walk (children, parentElement) {
    children.forEach(function (node) {
      if (node.type === 'push_props') {
	__adom_state.push({ props: node.scope })
      } else if (node.type === 'pop_props') {
	__adom_state.pop()
      } else {
	const sel = '[data-adom-id="' + node.id + '"]'
	if (node._each && node._each.iterator) {
	  const current = parentElement.querySelectorAll(sel)
	  const template = current[0]
	  const iterator = node._each.iterator[0]
	  const list = __get_value(node._each.list)
  
	  if (list.length === 0) {
	    template.hidden = true
	    for (let i = 1; i < current.length; i++) {
	      current[i].parentNode.removeChild(current[i])
	    }
	    return
	  }

	  function push_scope_and_continue (el, item) {
	    __adom_state.push({ [iterator]: item })
	    __update_node(el, node)
	    if (node.children.length) {
	      walk(node.children, el)
	    }
	    __adom_state.pop()
	  }  
	  
	  if (list.length <= current.length) {
	    list.forEach(function (item, i) {
	      push_scope_and_continue(current[i], item)
	    })
	  } else {
	    current.forEach(function (el, i) {
	      push_scope_and_continue(el, list[i])
	    })
	  }
	
	  if (list.length < current.length) {
	    for (let i = list.length; i < current.length; i++) {
	      current[i].parentNode.removeChild(current[i]) 
	    }
	  } else if (list.length > current.length) {
	    let frag = document.createDocumentFragment()
	    for (let i = current.length; i < list.length; i++) {
	      let el = template.cloneNode(true)
	      push_scope_and_continue(el, list[i])
	      frag.appendChild(el) 
	    }
	    current[current.length - 1].parentNode.insertBefore(frag, current[current.length - 1].nextSibling);
	  }
	} else {
	  const el = parentElement.querySelector(sel)
	  __update_node(el, node)
	  if (node.children.length) {
	    walk(node.children, el)
	  }
	}
      }
    })
  }
  walk(__adom_refs, document)
}`
  }

  module_roots.forEach(function (module) {
    let node = node_map[module.node.id]
    let code = modules[module.name]
    let events = find_events(module.node.children)
    let module_script = '(function () {' + runtime(module.node.children) + code + '\n'

    events.forEach(function (event) {
      module_script += `$attach('${event.event.type}', '[data-adom-id="${event.node.id}"]', ${event.event.handler});`
    })
  
    module_script += '})()'
    node.module = module_script
  })
}

function execute (nodes, _app_state) {
  let current_event_listeners = []
  let output = ''
  let indents = 0

  const doctype_map = {
    'html5': '<!DOCTYPE html>'
  }

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

  function assemble_textnode (chunks) {
    return chunks.map(get_value).join('').trim()
  }

  function assemble_attributes (obj) {
    return Object.keys(obj).map(function (k) { return k + '="' + get_value(obj[k]) + '"' }).join(' ')
  }
  
  function print_tag (node) {
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
      walk_node_tree(node.children)
      indents--
      output += (get_indents() + '</' + node.name + '>\n')
    } else {
      // make configurable based on doctype
      output += node.hidden ? ' hidden />\n' : ' />\n'
    }
    if (node.module) {
      output += (get_indents() + '<script>\n' + node.module + '\n' + get_indents() + '</script>\n')
    }
  }

  function walk_node_tree (tree) {
    tree.forEach(function (node) {
      let c = node.children
      if (node.type === 'doctype') {
	let dt = doctype_map[node.doctype]
	if (!dt) throw new Error('unknown doctype: ' + node.doctype)
	output += get_indents() + dt + '\n'
      } else if (node.type === 'push_props') {
	_app_state.push({ props: node.scope })
      } else if (node.type === 'pop_props') {
	_app_state.pop()
      } else if (node.type === 'tag') {
	if (node.control._if && !evaluate_condition(node.control._if)) {
	  node.hidden = true
	}
	if (node.control._each) {
	  let it = node.control._each.iterator[0]
	  let obj = get_value(node.control._each.list)
	  if (!Array.isArray(obj)) {
	    throw new Error('object is not iteratable')
	  }
	  if (obj.length === 0) {
	    node.hidden = true
	    _app_state.push({ [it]: undefined })
	    print_tag(node)
	    _app_state.pop()
	    return
	  }
	  obj.forEach(function (o) {
	    _app_state.push({ [it]: o })
	    print_tag(node)
	    _app_state.pop()
	  })
	  return
	}
	print_tag(node)
      } else if (node.type === 'textnode') {
	output += (get_indents() + assemble_textnode(node.chunks) + '\n')
      }
    })
  }

  walk_node_tree(nodes)

  return output
}

module.exports = function (input, input_state) {
  let state = [input_state]
  let tokens = tokenize(input, 0, input.length - 1)
  let [nodes, custom_tags, modules] = parse(tokens, state, input)

  nodes = expand_custom_tags(nodes, custom_tags, state)
  attach_modules(nodes, modules, state)

  let output = execute(nodes, state)

  return output
}

