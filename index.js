const fs = require('fs')

var adom = (function () {
  let prog = undefined
  
  let nodes = []
  let custom_tags = {} 
  let modules = {}
  let _app_state = []

  let tok = undefined
  let tokPos = 0
  let lineno = 1
  let cursor = 0
  let data = undefined
  let accessor_list = []
  let class_list = []
  let current_value
  let attr_list = {}
  let current_condition = undefined
  let current_each = undefined
  let current_event_listeners = []
  let store_ref = false
  let root = nodes
  let node_ref = 0

  const keywords = [
    'tag', 'module', 'doctype', 'layout', 'each', 'if', 'in', 'import', 'data', 'yield', 'set',
    'eq', 'ne', 'lt', 'gt', 'ge', 'le', 'on'
  ]

  const symbols = [
    '.', '#', '=', '[', ']', ';', '{', '}', '(', ')', '|', ':'
  ]

  function next () {
    let c = prog[cursor]
    
    tokPos = cursor

    if (cursor >= prog.length) {
      tok = 'eof'
    } else if (c === ' ' || c === '\n' || c === '\t') {
      let i = cursor
      while (c === ' ' || c === '\n' || c === '\t') {
	if (c === '\n') lineno++
	c = prog[++i]
      }
      cursor = i
      return next()
    } else if (c === '/' && prog[cursor+1] === '/') {
      let i = cursor
      while (c !== '\n' && i < prog.length)
	c = prog[++i]
      if (c === '\n') lineno++
      cursor = i
      return next()
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
      tok = 'int'
      data = parseInt(num)
    } else if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) {
      let i = cursor
      data = ''
      while ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '_' || c === '-') {
	data += c
	c = prog[++i]
      }
      cursor = i
      let idx = keywords.indexOf(data)
      if (idx !== -1) {
	tok = keywords[idx]
      } else {
	tok = 'ident'
      }
    } else if (symbols.indexOf(c) !== -1) {
      tok = c
      cursor++
    } else if (c === '"' || c === '\'') {
      const del = c
      let i = cursor
      data = ''
      c = prog[++i]
      while (c !== del) {
	data += c
	c = prog[++i]
      }
      cursor = i + 1
      tok = 'string'
    } else if (c === '-' && prog[cursor+1] === '-' && prog[cursor+2] === '>') {
      tok = '-->'
      cursor += 4
    } else {
      cursor++
    }
  }

  function print_error (c) {
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
    process.stdout.write(buf)
  }

  function expect(t) {
    if (tok === t) {
      next()
    } else {
      throw new Error('expected: ' + t + ' found: ' + tok)
    }
  }

  function accept(t) {
    if (tok === t) {
      next()
      return true
    }
    return false
  }

  function parse_classes () {
    if (accept('.')) {
      class_list.push(data)
      expect('ident')
      parse_classes()
    }
  }

  function parse_variable () {
    if (accept('.')) {
      let val = data
      expect('ident')
      accessor_list.push(val)
      parse_variable()
    } else if (accept('[')) {
      let val = data
      if (accept('int')) {
	accessor_list.push(val)	
      } else if (accept('string')) {
	accessor_list.push(val)
      } else {
	throw new Error('Cannot index array using value')
      }
      expect(']')
      parse_variable()   
    }
  }

  function parse_value () {
    if (tok === 'string' || tok === 'int') {
      current_value = data
      next()
    } else if (tok === 'ident') {
      accessor_list.push(data)
      current_value = accessor_list
      next()
      store_ref = true
      parse_variable()
      accessor_list = []
    } else {
      throw new Error('unexpected: ' + tok)
    }
  }


  function parse_ifexpr () {
    parse_value()
    let lhs = current_value
    let op = data
    if (accept('eq') || accept('ne') || accept('le') || accept('ge') || accept('gt') || accept('lt')) {
      parse_value()
      let rhs = current_value
      current_condition = { cmp: op, ops: [lhs, rhs] }
    } else {
      current_condition = { cmp: op, ops: [lhs, true] }
    }
    current_value = undefined
  }
  
  function parse_eachexpr () {
    let it = data
    expect('ident')
    expect('in')
    parse_value()
    let obj = current_value
    current_each = { iterator: it, object: obj }
  }

  function parse_attributes () {
    let key = data
    if (accept('ident')) {
      current_value = true
      if (accept('=')) {
	if (accept('{')) {
	  parse_value()
	  expect('}')
	} else {
	  current_value = data
	  expect('string')
	}
      }
      attr_list[key] = current_value
      parse_attributes()
    } else if (accept('if')) {
      expect('(')
      parse_ifexpr()
      expect(')')
      parse_attributes()
    } else if (accept('each')) {
      expect('(')
      parse_eachexpr()
      expect(')')
      parse_attributes()
    } else if (accept('on')) {
      expect(':')
      let evt = data
      expect('ident')
      expect('(')
      let hnd = data
      expect('ident')
      expect(')')
      current_event_listeners.push({ type: evt, handler: hnd })
      parse_attributes()
    }
  }

  function parse_textnode () {
    let i = cursor
    let chunks = []
    let text = ''
    c = prog[i]
    while (c !== '|' && i < prog.length - 1) {
      if (c === '{') {
	cursor = i + 1
	next()
	parse_value()
	chunks.push(text)
	chunks.push(current_value)
	text = ''
	i = cursor
	if (tok !== '}') {
	  throw new Error('unexpected:', tok)
	}
	c = prog[i]
      }
      text += c
      c = prog[++i]
    }
    chunks.push(text)
    cursor = i + 1
    next()
    return chunks
  }

  function parse_tag () {
    let node = { type: 'tag', name: data, children: [] }
    expect('ident')
    parse_classes()
    node.classes = class_list
    class_list = []
    parse_attributes()
    node.attributes = attr_list
    node.condition = current_condition
    node.each = current_each
    node.events = current_event_listeners
    node.store_ref = store_ref
    store_ref = false
    attr_list = {}
    current_condition = undefined
    current_each = undefined
    current_event_listeners = [] 
    if (accept(';')) {
      node.selfClosing = true
    } else if (accept('[')) {
      let par = root
      root = node.children
      parse_tag_list()
      root = par
      expect(']')
    } else if (tok === '|') {
      let textnode = parse_textnode()
      node.children.push({
	type: 'textnode',
	chunks: textnode,
	store_ref: store_ref
      })
      store_ref = false
    }
    root.push(node)
  }

  function parse_tag_list () {
    if (accept('doctype')) {
      root.push({ type: 'doctype', doctype: data })
      expect('ident')
      parse_tag_list()
    } if (tok === 'ident') {
      parse_tag()
      parse_tag_list()
    } else if (tok === '|') {
      let textnode = parse_textnode()
      root.push({
	type: 'textnode',
	chunks: textnode,
	store_ref: store_ref
      })
      store_ref = false
      parse_tag_list()
    } else if (accept('yield')) {
      root.push({ type: 'yield' })
      parse_tag_list()
    }
  }

  function parse_custom_tag () {
    expect('tag')
    let name = data
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

  function parse_dep_list () {
    if (accept('ident')) {
      parse_dep_list()
    }
  }

  function parse_module () {
    expect('module')
    let name = data
    expect('ident')
    if (accept('[')) {
      parse_dep_list()
      expect(']')
    }
    let tp = tokPos
    if (tok !== '-->') {
      throw new Error('expected -->')
    }
    let i = cursor
    let js = ''
    while (i < prog.length) {
      if (prog[i] === '\n' && prog[i+1] === '<' && prog[i+2] === '-' && prog[i+3] === '-') {
	i += 4
	break
      }
      js += prog[i++]
    }
    if (i >= prog.length) {
      tokPos = tp
      throw new Error('expected closing <--')
    }
    modules[name] = { code: js + '\n' }
    cursor = i
    next()
  }

  function parse_file () {
    if (tok === 'eof') {
      return
    } else if (tok === 'ident' || tok === 'doctype') {
      parse_tag_list()
      parse_file()
    } else if (tok === 'tag') {
      parse_custom_tag()
      parse_file()
    } else if (accept('set')) {
      let id = data
      expect('ident')
      parse_value()
      _app_state[0][id] = current_value
      parse_file()
    } else if (tok === 'module') {
      parse_module()
      parse_file()
    } else {
      throw new Error('unexpected: ' + tok)
    }
  }

  function compile () {
    parse_file()
  }

  let output = ''
  let indents = 0

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
    let lhs = condition.ops[0]
    let rhs = condition.ops[1]

    switch (condition.cmp) {
      case 'eq':
	if (get_value(lhs) == get_value(rhs))
	  return true
	return false
      case 'ne':
	if (get_value(lhs) != get_value(rhs))
	  return true
	return false
      case 'le':
	if (get_value(lhs) <= get_value(rhs))
	  return true
	return false
      case 'ge':
	if (get_value(lhs) >= get_value(rhs))
	  return true
	return false
      case 'lt':
	if (get_value(lhs) < get_value(rhs))
	  return true
	return false
      case 'gt':
	if (get_value(lhs) > get_value(rhs))
	  return true
	return false
      default:
	break
    }
    return false
  }

  function assemble_textnode (chunks, ref) {
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
  let arr = get_value(node.each.object)
  let it = node.each.iterator
  let frag = document.createDocumentFragment()
  if (arr.length > 0) 
    el.hidden = false
  arr.forEach(function (i) {
    console.log(it, i)
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
      if (node.children &&
	  node.children.length === 1 &&
	  node.children[0].type === 'textnode' &&
	  node.children[0].store_ref) {
	node.children[0].is_only_child = true
	node.children[0].store_ref = false
	node.store_ref = true
	node.chunks = node.children[0].chunks
      }
      if (node.store_ref) {
	node.ref = node_ref++
	if (node.attributes) {
	  node.attributes['data-adom-id'] = node.ref
	}
      }
      if (node.type === 'doctype') {
	output += get_indents() + ({
	  html5: '<!DOCTYPE html>'
	}[node.doctype]) + '\n'
      } else if (node.type === 'yield') {
	if (yield_func) {
	  yield_func()
	}	 
      } else if (node.type === 'tag') {
	if (node.condition && !evaluate_condition(node.condition)) {
	  node.hidden = true
	}
	if (node.each) {
	  let it = node.each.iterator
	  let obj = get_value(node.each.object)
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
	if (node.events && node.events.length > 0) {
	  node.events.forEach(function (evt) {
	    if (evt.type === 'load') {
	      output += create_module(modules[evt.handler])
	    }
	  })
	}
      } else if (node.type === 'textnode') {
	output += (get_indents() + assemble_textnode(node.chunks, (node.store_ref && !node.is_only_child) ? node.ref : -1) + '\n')
      }
    })
  }


  return function (input, input_state) {
    _app_state.push(input_state)
    prog = input
    next()

    try {
      compile()
    } catch (e) {
      console.log(e.toString())
      print_error(tokPos)    
      return
    }

    walk_node_tree(nodes)
    
    return output
  }

})()

module.exports = adom
