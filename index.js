function Adom (config) {
  this.cache = config.cache || false
  this.dirname = config.root || ''
  this.files = {}
}

Adom.prototype.tokenize = function (prog, file) {
  var cursor = 0, end_pos = prog.length - 1
  var tokens = [{ type: 'file_begin', data: file, pos: 0, file: file }]

  var keywords = [
    'tag', 'module', 'doctype', 'layout', 'each', 'if', 'in', 'else',
    'import', 'yield', 'on', 'null', 'export', 'file', 'controller', 'and', 'or'
  ]

  var symbols = [
    '.', '#', '=', '[', ']', ';', '{', '}', '(', ')', ':', '$', ',', '>', '<', '?'
  ]

  function break_into_chunks (text, cursor) {
    var chunks = []
    var chunk = ''
    var i = 0, max = text.length
    var in_expr = false
    var pos = cursor
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
      	var toks = this.tokenize(chunk, file)
        toks.shift() //file_begin
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
    var c = prog[cursor]
    var tok = { type: '', data: '', pos: cursor, file: file }

    if (cursor > end_pos) {
      tok.type = 'eof'
      tokens.push(tok)
      break
    } else if (c === ' ' || c === '\n' || c === '\t') {
      var i = cursor
      while (i <= end_pos && (prog[i] === ' ' || prog[i] === '\t' || prog[i] === '\n')) {
        i++
      }
      cursor = i
      continue
    } else if (c === '/' && prog[cursor+1] === '/') {
      var i = cursor
      while (c !== '\n' && i <= end_pos)
        c = prog[++i]
      cursor = i
      continue
    } else if (c >= '0' && c <= '9') {
      var neg = tokens[tokens.length - 1].type === '-'
      var num = ''
      var i = cursor
      var dot = false
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
      var i = cursor
      tok.data = ''
      while ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '_' || c === '-') {
        tok.data += c
        c = prog[++i]
      }
      cursor = i
      var idx = keywords.indexOf(tok.data)
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
      var i = cursor + 1
      var text = ''
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
      var chunks = break_into_chunks.call(this, text, cursor)
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
      var str = ''
      var i = cursor + 3
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
      var del = c
      var i = cursor + 1

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
      var i = cursor + 3
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
  var tok = tokens[0]
  var cursor = 0
  var files = []
  var ops = []

  function new_context () {
    files.push({
      tags: {}, modules: {}, exports: []
    })
  }

  function emit (op, data) {
    var i = { op: op }
    if (data) i.data = data
    ops.push(i)
    return ops.length - 1
  }

  function next() {
    tok = tokens[++cursor]
  }

  function unexpected () {
    throw { msg: 'unexpected ' + tok.type, pos: tok.pos, file: tok.file }
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

  function peek(t) {
    if (tok.type === t) {
      return true
    }
    return false
  }

  function is_primitive () {
    return peek('string') || peek('number') || peek('bool')
  }

  function parse_primitive () {
    if (!accept('string') && !accept('number') && !accept('bool')) {
      unexpected()
    }
  }

  function parse_modifier () {
    if (accept('.')) {
      expect('ident')
      parse_modifier()
    } else if (accept('[')) {
      parse_variable_or_primitive()
      expect(']')
      parse_modifier()
    }
  }

  function parse_variable () {
    expect('ident')
    parse_modifier()
  }

  function parse_variable_or_primitive () {
    if (is_primitive()) {
      parse_primitive()
    } else if (peek('ident')) {
      parse_variable()
    } else {
      unexpected()
    }
  }

  function parse_comparison () {
    return (
      accept('==') ||
      accept('!=') ||
      accept('<=') ||
      accept('>=') ||
      accept('>') ||
      accept('<')
    )
  }

  function parse_variable_primitive_or_ternary () {
    parse_variable_or_primitive()
    if (parse_comparison()) {
      parse_variable_or_primitive()
      expect('?')
      parse_variable_or_primitive()
      expect(':')
      parse_variable_or_primitive()
    }
  }

  function parse_object () {
    expect('{')
    while (true) {
      expect('ident')
      expect(':')
      if (peek('[')) {
	parse_array() 
      } else if (peek('{')) {
	parse_object()
      } else {
	parse_variable_or_primitive()
      }
      if (!accept(',')) break
    }
    expect('}')
  }

  function parse_array () {
    expect('[')
    while (true) {
      if (peek('[')) {
	parse_array() 
      } else if (peek('{')) {
	parse_object()
      } else {
	parse_variable_or_primitive()
      }
      if (!accept(',')) break
    }
    expect(']')
  }

  function parse_textnode () {
    var chunks = []
    while (true) {
      expect('chunk')
      if (!accept('{')) break
      parse_variable_or_primitive()
      expect('}')
    }
    return chunks
  }

  function parse_class_list () {
    var classes = []
    while (true) {
      if (!accept('.')) break
      classes.push(tok.data)
      expect('ident')
    }
    return classes
  }

  function parse_attributes () {
    var attr = {}
    while (true) {
      if (accept('ident')) {
        if (accept('=')) {
          if (accept('{')) {
	    if (peek('[')) {
	      parse_array()
	    } else {
	      parse_variable_primitive_or_ternary()
	    }
            expect('}')
          } else if (tok.type === 'string') {
            next()
          } else {
            throw { msg: 'unexpected ' + tok.type, pos: tok.pos, file: tok.file }
          }
        } else {
        }
      } else if (accept('on')) {
        expect(':')
        expect('ident')
        expect('(')
        expect('ident')
        expect(')')
      } else if (accept('controller')) {
        expect('(')
        expect('ident')
        expect(')')
      } else {
        break
      }
    }
    return attr
  }

  function parse_tag () {
    var name = tok.data
    expect('ident')
    var classlist = parse_class_list()
    var attr = parse_attributes()
    if (accept(';')) {
    } else if (accept('[')) {
      parse_tag_list()
      expect(']')
    } else if (tok.type === 'chunk') {
    } else {
      throw { msg: 'unexpected ' + tok.type, pos: tok.pos, file: tok.file }
    }
  }

  function parse_conditional () {
    var cond = {}
    while (true) {
      parse_variable_or_primitive()
      if (!parse_comparison()) {
	throw { msg: 'expected comparison operator', pos: tok.pos, file: tok.file }
      }
      parse_variable_or_primitive()
      if (accept('or')) {
	continue
      } else if (accept('and')) {
	continue
      } else {
        break
      }
    }
  }

  function parse_if_statement () {
    expect('(')
    parse_conditional()
    expect(')')
    if (accept('[')) {
      parse_tag_list()
      expect(']')
    } else {
      parse_tag()
    }
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
  }

  function parse_tag_list () {
    if (accept('doctype')) {
      var type = tok.data
      expect('ident')
      emit('doctype', type)
      parse_tag_list()
    } else if (accept('if')) {
      parse_if_statement()
      parse_tag_list()
    } else if (accept('each')) {
      expect('(')
      expect('ident')
      if (accept(',')) {
        expect('ident')
      }
      expect('in')
      if (peek('[')) {
	parse_array()
      } else {
	parse_variable()
      }
      expect(')')
      expect('[')
      parse_tag_list()
      expect(']')
      parse_tag_list()
    } else if (tok.type === 'ident') {
      parse_tag()
      parse_tag_list()
    } else if (tok.type === 'chunk') {
      parse_textnode()
      parse_tag_list()
    } else if (accept('yield')) {
      parse_tag_list()
    }
  }

  function parse_custom_tag () {
    expect('tag')
    var tag = tok.data
    expect('ident')
    var start = cursor
    expect('[')
    parse_tag_list()
    var end = cursor
    expect(']')
    files[files.length - 1].tags[tag] = { start: start, end: end }
  }

  function parse_file () {
    if (tok.type === 'file_begin') {
      new_context()
      next()
      parse_file()
    } if (tok.type === 'eof') {
      console.log(files.pop())
      if (files.length === 0) {
        return
      } else {
        next()
        parse_file()
      }
    } else if (accept('export')) {
      var exp = tok.data
      expect('ident')
      files[files.length-1].exports.push(exp)
      parse_file()
    } else if (tok.type === 'ident' || tok.type === 'doctype') {
      parse_tag_list()
      parse_file()
    } else if (tok.type === 'tag') {
      parse_custom_tag()
      parse_file()
    } else if (accept('$')) {
      parse_variable()
      expect('=')
      if (accept('file')) {
        expect('string')
        parse_file()
      } else {
	if (peek('[')) {
	  parse_array()
	} else if (peek('{')) {
	  parse_object()
	} else {
	  parse_variable_or_primitive()
	}
        parse_file()
      }
    } else if (accept('module')) {
      var module = tok.data
      expect('ident')
      var module_body = tok.data
      expect('module_body')
      files[files.length - 1].modules[module] = module_body 
      parse_file()
    } else {
      throw { msg: 'unexpected: ' + tok.type, pos: tok.pos, file: tok.file }
    }
  }

  parse_file()

  return ops
}

Adom.prototype.get_error_text = function (prog, c) {
  var i = c
  var buf = '', pad = ''
  var pos = c
  var line = 1
  while (pos >= 0) if (prog[pos--] === '\n') line++
  buf += line + '| '
  var np = line.toString().length + 2
  for (var k = 0; k < np; k++) pad += ' '
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
  var $$adom_state = `,
// state will get inserted here during the execution step
// because it may get modified there
  `
  var $$adom_props = []
  var $$adom_events = undefined
  var $$adom_prev_tree = undefined

  function $$adom_flatten (arr) {
    var nodes = []
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
    var c = children ? $$adom_flatten(children) : undefined
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
    var nodes = []

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
      var c = node.content.trim()
      if (c) {
        var t = document.createElement('div')
        t.innerHTML = c
        return t.childNodes[0]
      }
      return document.createTextNode('')
    }
    var el = document.createElement(node.type)
    Object.keys(node.attributes).forEach(function (attr) {
      el.setAttribute(attr, node.attributes[attr])
    })
    return el
  }

  function $$adom_create_dom_tree (nodes) {
    var rootNode = document.createDocumentFragment()
    function walk (children) {
      var prev
      children.forEach(function (node) {
        var el = $$adom_create_node(node)
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
    var root_node = $$adom_select('[data-adom-id="${config.root}"]')[0]
    var nodes = $$adom_create_node_tree()
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

Adom.prototype.openFile = function (p) {
  var fs = require('fs')
  var path = require('path')
  var f = path.resolve(this.dirname, p)
  var prog = fs.readFileSync(f).toString()
  this.files[f] = prog
  return [prog, f]
}

Adom.prototype.resolve_imports = function (tokens, file) {
  var out_toks = []
  var ptr = 0

  while (ptr < tokens.length) {
    switch (tokens[ptr].type) {
      case 'import': {
        var path = tokens[++ptr].data
        var fileData = this.openFile(path)
        var toks = this.tokenize(fileData[0], fileData[1])
        toks = this.resolve_imports(toks, fileData[1])
        toks.forEach(function (t) {
          out_toks.push(t)
        })
      } break
      default:
        out_toks.push(tokens[ptr])
      break
    }
    ptr++
  }

  return out_toks
}

Adom.prototype.compile_file = function (file, input_state) {
  try {
    var fileData = this.openFile(file)
    var tokens = this.tokenize(fileData[0], fileData[1])
    tokens = this.resolve_imports(tokens, fileData[1])
    console.log(tokens)
    var ops = this.parse(tokens)
    var files = this.files
    var err = this.get_error_text
  } catch (e) {
    if (e.pos) {
      console.log('Error: ', e.file)
      console.log(e.msg)
      console.log(this.get_error_text(this.files[e.file], e.pos))
    } else if (e.msg) {
      console.log(e.msg)
    } else {
      console.log(e)
    }
    return ''
  }
}

module.exports = Adom
