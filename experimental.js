let test0 = `
html [
  div.btn-class attr1='123' attr2='234' [
    div if(test.field eq 'testClass') [
      span | evaluated to true |
      span | evaluated to true! | 
    ]

    p | {test.field} |
    div.mydiv []
 
    span attr='hello' class={test.field} [
      | Hello, world! |
    ]
  ]
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
  let root = nodes
  let _app_state = {
    test: { field: 'testClass' },
    cats: ['brown cat', 'white cat', 'black cat']
  }

  const keywords = [
    'block', 'code', 'doctype', 'layout', 'each', 'if', 'in', 'import', 'data',
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
      }
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

  let expr = undefined
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

  function parse_eachexpr () {
    expect('ident')
    expect('in')
    parse_value()
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
    let text = '' 
    let interpolants = []
    c = prog[++i]
    while (c !== '|' && i < prog.length - 1) {
      if (c === '{') {
	cursor = i + 1
	next()
	parse_value()
	interpolants.push(current_value)
	i = cursor
	if (tok !== '}') {
	  throw new Error('unexpected:', tok)
	}
	c = prog[i]
      }
      text += c
      c = prog[++i]
    }
    cursor = i + 1
    next()
    return text
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
    attr_list = {}
    current_condition = undefined
    if (accept(';')) {
      node.selfClosing = true
    } else if (accept('[')) {
      let par = root
      root = node.children
      parse_tag_list()
      root = par
      expect(']')
    } else if (tok === '|') {
      let text = parse_textnode()
      node.children.push({ type: 'textnode', data: text.trim() })
    }
    root.push(node)
  }

  function parse_tag_list () {
    if (tok === 'ident') {
      parse_tag()
      parse_tag_list()
    } else if (tok === '|') {
      let text = parse_textnode()
      root.push({ type: 'textnode', data: text.trim() })
      parse_tag_list()
    }
  }

  function parse_file () {
    if (tok === 'eof') {
      return
    } else if (tok === 'ident') {
      parse_tag_list()
      parse_file()
    } else {
      throw new Error('unexpected: ' + tok)
    }
  }

  function compile () {
    parse_file()
  }

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
    v1 = _app_state
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

  function execute (tree) {
    tree.forEach(function (node) {
      if (node.type === 'tag') {
	if (node.condition) {
	  if (!evaluate_condition(node.condition)) {
	    return
	  }
	}
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
	    line += ('>' + node.children[0].data + '</' + node.name + '>')
	    console.log(line)
	  } else {
	    line += '>'
	    console.log(line)
	    indents++
	    execute(node.children)
	    indents--
	    console.log(get_indents() + '</' + node.name + '>')
	  }
	} else {
	  // make configurable based on doctype
	  line += ' />'
	  console.log(line)
	}
      } else if (node.type === 'textnode') {
	console.log(get_indents() + node.data)
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
    execute(nodes)
  }

})()

adom(test0)