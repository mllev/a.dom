let test0 = `

set str 'hello'

module main [utils] --> 
  function sayHi () {
    alert('hi')
  }
<--

tag ListItem [
  li | {props.item} |
]

tag Page [
  html [
    head [
      meta title={props.title};
    ]
    body [
      yield
    ]
  ]
]

Page title='My Page' [
  div.btn-class attr1='123' attr2='234' [
    ListItem each(item in cats) ;
    button onclick='sayHi()' | Say Hi |
  ]
  span | {str} |
]
`

let test = `
code Main -->

<--

doctype html5

html [
  head [
    meta attr='true';
  ]
  body [
    nav [
      a.href='' []
      a.href='' []
      span | {navTitle} |
    ]
    div root [
      span | {title} |
    ]
    [Main]
  ]
]

`
var adom = (function () {
  let prog = undefined
  let tok = undefined
  let tokPos = 0
  let lineno = 1
  let cursor = 0
  let data = undefined
  let nodes = []
  let custom_tags = {} 
  let modules = {}
  let root = nodes
  let _app_state = [{
    test: { field: 'testClass' },
    cats: ['brown cat', 'white cat', 'black cat']
  }]

  const keywords = [
    'tag', 'module', 'doctype', 'layout', 'each', 'if', 'in', 'import', 'data', 'yield', 'set',
    'eq', 'ne', 'lt', 'gt', 'ge', 'le'
  ]

  const symbols = [
    '.', '#', '=', '[', ']', ';', '{', '}', '(', ')', '|'
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

  let class_list = []

  function parse_classes () {
    if (accept('.')) {
      class_list.push(data)
      expect('ident')
      parse_classes()
    }
  }

  let accessor_list = []

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

  let current_value

  function parse_value () {
    if (tok === 'string' || tok === 'int') {
      current_value = data
      next()
    } else if (tok === 'ident') {
      accessor_list.push(data)
      current_value = accessor_list
      next()
      parse_variable()
      accessor_list = []
    } else {
      throw new Error('unexpected: ' + tok)
    }
  }

  let current_condition = undefined

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
  
  let current_each = undefined

  function parse_eachexpr () {
    let it = data
    expect('ident')
    expect('in')
    parse_value()
    let obj = current_value
    current_each = { iterator: it, object: obj }
  }

  let attr_list = {}

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
    attr_list = {}
    current_condition = undefined
    current_each = undefined
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
	chunks: textnode
      })
    }
    root.push(node)
  }

  function parse_tag_list () {
    if (tok === 'ident') {
      parse_tag()
      parse_tag_list()
    } else if (tok === '|') {
      let textnode = parse_textnode()
      root.push({
	type: 'textnode',
	chunks: textnode
      })
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
    modules[name] = { code: js }
    cursor = i
    next()
  }

  function parse_file () {
    if (tok === 'eof') {
      return
    } else if (tok === 'ident') {
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

  function assemble_textnode (chunks) {
    return chunks.map(get_value).join('').trim()
  }

  function print_node (node, yield_func) {
    let line = get_indents() + '<' + node.name
    if (node.classes.length > 0) {
      if (node.attributes.class) {
	node.attributes.class = (node.classes.join(' ') + ' ' + node.attributes.class)
      } else {
	node.attributes.class = node.classes.join(' ')
      }
    }
    if (node.attributes) {
      Object.keys(node.attributes).forEach(function (attr) {
	let v = get_value(node.attributes[attr])
	line += (' ' + attr + '=' + '"' + v + '"')
      })
    }
    if (!node.selfClosing) {
      if (node.children.length === 1 && node.children[0].type === 'textnode') {
	line += ('>' + assemble_textnode(node.children[0].chunks) + '</' + node.name + '>')
	output += (line + '\n')
      } else {
	output += (line + '>' + '\n')
	indents++
	walk_node(node.children, yield_func)
	indents--
	output += (get_indents() + '</' + node.name + '>' + '\n')
      }
    } else {
      // make configurable based on doctype
      line += ' />'
      output += (line + '\n')
    }
  }

  function walk_node (tree, yield_func) {
    tree.forEach(function (node) {
      if (node.type === 'yield') {
	if (yield_func) {
	  yield_func()
	}	 
      } else if (node.type === 'tag') {
	if (node.condition && !evaluate_condition(node.condition)) {
	  return
	}
	if (node.each) {
	  let it = node.each.iterator
	  let obj = get_value(node.each.object)
	  if (!Array.isArray(obj)) {
	    throw new Error('object is not iteratable')
	  }
	  obj.forEach(function (o) {
	    if (custom_tags[node.name]) {
	      let props = node.attributes
	      props[it] = o 
	      _app_state.push({ props: props })
	      walk_node(custom_tags[node.name].children, function () {
		walk_node(node.children, yield_func)
	      })
	      _app_state.pop()
	    } else {
	      _app_state.push({ [it]: o })
	      print_node(node, yield_func)
	      _app_state.pop()
	    }
	  })
	  return
	}
	if (custom_tags[node.name]) {
	  _app_state.push({ props: node.attributes })
	  walk_node(custom_tags[node.name].children, function () {
	    walk_node(node.children, yield_func)
	  })
	  _app_state.pop()
	} else {
	  print_node(node, yield_func)
	}
      } else if (node.type === 'textnode') {
	output += (get_indents() + assemble_textnode(node.chunks) + '\n')
      }
    })
  }


  return function (input) {
    prog = input
    next()
    try {
      compile()
    } catch (e) {
      console.log(e.toString())
      print_error(tokPos)    
      return
    }
    walk_node(nodes)
    console.log(output)
  }

})()

adom(test0)
