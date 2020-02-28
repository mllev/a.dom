var Adom = (function () {

let _c = 0;

const _file = _c++;
const _export = _c++;
const _doctype = _c++;
const _if = _c++;
const _each = _c++;
const _tag = _c++;
const _custom = _c++;
const _yield = _c++;
const _textnode = _c++;
const _set = _c++;
const _block = _c++;

function Adom (config) {
  config = config || {};
  this.opcode_cache = {};
  this.cache = config.cache || false;
  this.dirname = config.rootDir || "";
  this.runtimeTransform = config.runtimeTransform;
  this.files = {};
  this.uid = Math.floor(Math.random() * 10000);
}

function ASTNode (type, data) {
  this.type = type;
  this.data = data;
  this.children = [];
}

ASTNode.prototype.addChild = function (node) {
  this.children.push(node);
};

function throw_adom_error (err) {
  err.origin = 'adom';
  throw err;
};

const void_tags = [
  'area',
  'base',
  'basefont',
  'bgsound',
  'br',
  'col',
  'command',
  'embed',
  'frame',
  'hr',
  'image',
  'img',
  'input',
  'isindex',
  'keygen',
  'link',
  'menuitem',
  'meta',
  'nextid',
  'param',
  'source',
  'track',
  'wbr'
];

Adom.prototype.tokenize = function(prog, file, offset) {
  let cursor = 0, end_pos = prog.length - 1;
  let tokens = [{ type: "file_begin", data: file, pos: 0, file: file }];
  let keywords = [
    "tag",
    "doctype",
    "each",
    "if",
    "in",
    "else",
    "import",
    "yield",
    "on",
    "null",
    "export",
    "file",
    "var",
    "const",
    "root",
    "css"
  ];

  let symbols = [
    ".",
    "#",
    "=",
    "[",
    "]",
    ";",
    "{",
    "}",
    "(",
    ")",
    ":",
    "$",
    ",",
    ">",
    "<",
    "?"
  ];

  function is_newline (c) {
    return c == '\n' || c == '\r'
  }

  function break_into_chunks(text, cursor) {
    let chunks = [];
    let chunk = "";
    let i = 0,
      max = text.length;
    let in_expr = false;
    let pos = cursor;
    while (i < max) {
      if (text[i] === "{" && text[i+1] === "{" && in_expr === false) {
        in_expr = true;
        chunks.push({ type: "chunk", data: chunk, pos: pos, file: file });
        chunk = "{";
        i+=2;
        pos = cursor + i;
      } else if (text[i] === "}" && text[i+1] === "}" && in_expr === true) {
        in_expr = false;
        chunk += "}";
        let toks = this.tokenize(chunk, file, pos);
        toks.shift(); //file_begin
        toks.pop(); //eof
        toks.forEach(function(t) {
          chunks.push(t);
        });
        chunk = "";
        i+=2;
        pos = cursor + i + 1;
      } else {
        chunk += text[i++];
      }
    }
    chunks.push({ type: "chunk", data: chunk, pos: pos, file: file });
    return chunks;
  }

  let offs = offset || 0;

  while (true) {
    let c = prog[cursor];
    let tok = { type: "", data: "", pos: offs + cursor, file: file };

    if (cursor > end_pos) {
      tok.type = "eof";
      tokens.push(tok);
      break;
    } else if (c === " " || is_newline(c) || c === "\t") {
      let i = cursor;
      while (
        i <= end_pos &&
        (prog[i] === " " || prog[i] === "\t" || is_newline(prog[i]))
      ) {
        i++;
      }
      cursor = i;
      continue;
    } else if (c === "/" && prog[cursor + 1] === "/") {
      let i = cursor;
      while (c !== "\n" && i <= end_pos) c = prog[++i];
      cursor = i;
      continue;
    } else if (c >= "0" && c <= "9") {
      let neg = tokens[tokens.length - 1].type === "-";
      let num = "";
      let i = cursor;
      let dot = false;
      while ((c >= "0" && c <= "9") || c === ".") {
        if (c === ".") {
          if (dot) break;
          else dot = true;
        }
        num += c;
        c = prog[++i];
      }
      cursor = i;
      tok.type = "number";
      tok.data = parseFloat(num);
      if (neg) {
        tok.data *= -1;
        tokens.pop();
      }
    } else if ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z")) {
      let i = cursor;
      tok.data = "";
      while (
        (c >= "a" && c <= "z") ||
        (c >= "A" && c <= "Z") ||
        (c >= "0" && c <= "9") ||
        (c === "_") ||
        (c === "-")
      ) {
        tok.data += c;
        c = prog[++i];
      }
      cursor = i;
      let idx = keywords.indexOf(tok.data);
      if (idx !== -1) {
        tok.type = keywords[idx];
      } else {
        tok.type = "ident";
      }
      if (tok.data === "true" || tok.data === "false") {
        tok.type = "bool";
        tok.data = tok.data === "true";
      } else if (tok.data === "null") {
        tok.data = null;
      }
    } else if (c === "<" && prog[cursor + 1] === "=") {
      tok.type = "<=";
      tok.data = "<=";
      cursor += 2;
    } else if (c === ">" && prog[cursor + 1] === "=") {
      tok.type = ">=";
      tok.data = ">=";
      cursor += 2;
    } else if (c === "=" && prog[cursor + 1] === "=") {
      tok.type = "==";
      tok.data = "==";
      cursor += 2;
    } else if (c === "!" && prog[cursor + 1] === "=") {
      tok.type = "!=";
      tok.data = "!=";
      cursor += 2;
    } else if (c === "&" && prog[cursor + 1] === "&") {
      tok.type = "&&";
      tok.data = "&&";
      cursor += 2;
    } else if (c === "|" && prog[cursor + 1] === "|") {
      tok.type = "||";
      tok.data = "||";
      cursor += 2;
    } else if (symbols.indexOf(c) !== -1) {
      tok.type = c;
      tok.data = c;
      cursor++;
    } else if (
      c === '"' &&
      prog[cursor + 1] === '"' &&
      prog[cursor + 2] === '"'
    ) {
      let str = "";
      let i = cursor + 3;
      while (true) {
        if (i > end_pos) {
          throw_adom_error({ msg: "unterminated long string", pos: offs + cursor, file: file });
        } else if (
          prog[i] === '"' &&
          prog[i + 1] === '"' &&
          prog[i + 2] === '"'
        ) {
          i += 3;
          break;
        }
        str += prog[i++];
      }
      tokens.push({ type: 'string', pos: offs + cursor, file: file });
      tokens.push({ type: 'chunk', data: str, pos: offs + cursor, file: file })
      cursor = i;
      continue;
    } else if (c === '"' || c === "'") {
      let del = c;
      let i = cursor + 1;
      let text = '';
      while (true) {
        if (i > end_pos || is_newline(prog[i])) {
          throw_adom_error({ msg: "unterminated string", pos: offs + cursor, file: file });
        }
        if (prog[i] === del) {
          i++;
          break;
        }
        if (prog[i] === "\\" && prog[i + 1] === del) {
          text += prog[i + 1];
          i += 2;
        }
        text += prog[i++];
      }
      let chunks = break_into_chunks.call(this, text, cursor);
      tokens.push({ type: 'string', pos: offs + cursor, file: file });
      if (chunks.length > 1) {
        chunks.forEach(function(c) {
          tokens.push(c);
        });
      } else {
        tokens.push({ type: 'chunk', data: text, pos: offs + cursor, file: file })
      }
      cursor = i;
      continue;
    } else if (
      c === "-" &&
      prog[cursor + 1] === "-"
    ) {
      let i = cursor + 2;
      let found = false;
      while (i <= (end_pos - 2)) {
        if (
          prog[i] === "\n" &&
          prog[i + 1] === "-" &&
          prog[i + 2] === "-"
        ) {
          i += 3;
          found = true;
          break;
        }
        tok.data += prog[i++];
      }
      if (!found) {
        throw_adom_error({ msg: "expected closing --", pos: offs + cursor, file: file });
      }
      cursor = i;
      tok.type = "module_body";
    } else {
      tok.type = tok.data = c;
      cursor++;
    }
    tokens.push(tok);
  }

  return tokens;
};

Adom.prototype.parse = function(tokens) {
  let tok = tokens[0];
  let cursor = 0;
  let files = [];
  let pending = [];
  let runtime = '';
  let root_found = false;
  let in_tag = false;
  let implicit_class = undefined;
  let global_styles = '';
  let ast = new ASTNode(_file, {});
  let parent = ast;

  function ast_node(type, data) {
    let node = new ASTNode(type, data);
    parent.addChild(node);
    return node;
  }

  function next() {
    tok = tokens[++cursor];
    if (cursor === tokens.length) return 0;
    return 1;
  }

  function unexpected() {
    throw_adom_error({ msg: "unexpected " + tok.type, pos: tok.pos, file: tok.file });
  }

  function expect(t) {
    if (tok.type === t) {
      next();
    } else {
      throw_adom_error({
        msg: "expected: " + t + " found: " + tok.type,
        pos: tok.pos,
        file: tok.file
      });
    }
  }

  function accept(t) {
    if (tok.type === t) {
      next();
      return true;
    }
    return false;
  }

  function peek(t) {
    if (tok.type === t) {
      return true;
    }
    return false;
  }

  function parse_string () {
    let data = [];
    let pos = tok.pos;
    let file = tok.file;
    expect('string');
    while (true) {
      let d = tok.data;
      if (accept('chunk')) {
        data.push({ type: 'chunk', data: d });
      } else if (accept('{')) {
        data.push(parse_expr());
        expect('}');
      } else {
        break;
      }
    }
    return { type: 'string', data: data, pos: pos, file: file }
  }

  function parse_acc () {
    let acc = null;

    while (true) {
      if (accept('.')) {
        let p = tok.pos, f = tok.file;
        if (!acc)  acc = [];
        // because .ident is short for ['ident'] as in javascript
        acc.push({
          type: "string",
          data: [{
            type: "chunk",
            data: tok.data
          }],
          pos: p,
          file: f 
        });
        expect('ident');
      } else if (accept('[')) {
        if (!acc) acc = [];
        acc.push(parse_expr());
        expect(']');
      } else {
        break;
      }
    }

    return acc;
  }

  function is_comparison () {
    return peek('==') ||
      peek('<=') ||
      peek('>=') ||
      peek('!=') ||
      peek('>') ||
      peek('<');
  }

  function parse_variable () {
    let ident = tok.data;
    let v = { pos: tok.pos, file: tok.file };
    expect('ident');
    let acc = parse_acc();
    if (acc) {
      acc.unshift({
        type: 'ident',
        data: ident,
        pos: v.pos, file: v.file
      });
      v.type = 'accumulator';
      v.data = acc;
    } else {
      v.type = "ident";
      v.data = ident;
    }
    return v;
  }

  function parse_expr (prec) {
    if (prec == null) prec = 0;
    let expr = { pos: tok.pos, file: tok.file };
    if (peek('number') || peek('bool') || peek('null')) {
      expr.type = tok.type;
      expr.data = tok.data;
      next();
    } else if (peek('string')) {
      expr = parse_string();
    } else if (peek('ident')) {
      expr = parse_variable();
    } else if (accept('(')) {
      let ex = parse_expr();
      expect(')');
      let acc = parse_acc();
      if (acc) {
        acc.unshift(ex);
        expr.type = 'accumulator';
        expr.data = acc;
      } else {
        expr.type = 'parenthetical'
        expr.data = ex;
      }
    } else if (peek('{')) {
      expr.type = 'object';
      expr.data = parse_object();
    } else if (peek('[')) {
      expr.type = 'array';
      expr.data = parse_array();
    } else {
      unexpected();
    }
    if (is_comparison()) {
      let cmp = tok.type;
      let lhs = expr;
      next();
      let rhs = parse_expr(2);
      expr = {
        type: 'comparison',
        op: cmp,
        data: [ lhs, rhs ],
        pos: expr.pos,
        file: expr.file
      };
    }
    if (prec < 2 && (peek('&&') || peek('||'))) {
      let cmp = tok.type;
      let lhs = expr;
      next();
      let rhs = parse_expr(1);
      expr = {
        type: 'comparison',
        op: cmp,
        data: [ lhs, rhs ],
        pos: expr.pos,
        file: expr.file
      };
    }
    if (prec < 1 && accept('?')) {
      expr = {
        type: 'ternary',
        data: [expr],
        pos: expr.pos,
        file: expr.file
      };
      expr.data.push(parse_expr());
      expect(':');
      expr.data.push(parse_expr());
    }
    return expr;
  }

  function parse_object() {
    let obj = {};
    expect("{");
    if (!peek('}')) {
      while (true) {
      	let key = tok.data;
      	expect("ident");
      	expect(":");
        obj[key] = parse_expr();
      	if (!accept(",")) break;
      }
    }
    expect("}");
    return obj;
  }

  function parse_array() {
    let arr = [];
    expect("[");
    if (!peek(']')) {
      while (true) {
        arr.push(parse_expr());
        if (!accept(",")) break;
      }
    }
    expect("]");
    return arr;
  }

  function parse_class_list() {
    let classes = [];
    if (implicit_class) {
      classes.push({
        type: 'string',
        data: [{ type: 'chunk', data: implicit_class }]
      });
      implicit_class = undefined;
    }
    while (true) {
      if (!accept(".")) break;
      classes.push({
        type: "string",
        data: [{
          type: 'chunk',
          data: tok.data
        }],
        pos: tok.pos,
        file: tok.file
      });
      expect("ident");
    }
    return {
      type: "array",
      data: classes
    };
  }

  const UID = this.uid;

  function parse_attributes() {
    let attr = {};
    let events = [];
    while (true) {
      let key = tok.data;
      if (accept("root")) {
        let pos = tok.pos;
        let file = tok.file;
        if (root_found === true) {
          throw_adom_error({
            msg: 'root node already declared',
            pos: pos,
            file: file
          });
        }
        root_found = true;
        attr.root = true;
        attr.id = { type: 'string', data: [{ type: 'chunk', data: `adom-root-${UID}` }] };
      } else if (accept("ident")) {
        if (accept("=")) {
          if (accept("{")) {
            attr[key] = parse_expr();
            expect("}");
          } else if (peek("string")) {
            attr[key] = parse_string();
          } else {
            throw_adom_error({
              msg: "unexpected " + tok.type,
              pos: tok.pos,
              file: tok.file
            });
          }
        } else {
          attr[key] = { type: "bool", data: true };
        }
      } else if (accept("on")) {
        expect(":");
        let handler;
        let evt = tok.data;
        expect("ident");
        expect("=");
        handler = parse_strict_string();
        events.push({ type: evt, handler: handler });
      } else {
        break;
      }
    }
    return [attr, events];
  }

  function create_selector (sel) {
    let str = sel[0];
    for (let i = 1; i < sel.length; i++) {
      let s = sel[i].trim();
      if (s.indexOf('&') !== -1) {
        str = s.replace('&', str);
      } else {
        str += ` ${s}`;
      }
    }
    return str;
  }

  function transform_to_css (styles) {
    let rules = [];
    let selector = [];

    function visit (node) {
      let ruleset = node.rules.map(rule => `${rule[0]}:${rule[1]}; `).join('');
      if (node.sel.indexOf('@') > -1) {
        rules.push(`${node.sel} { ${create_selector(selector)} { ${ruleset} } } `);
      } else {
        selector.push(node.sel);
        rules.push(`${create_selector(selector)} { ${ruleset} } `);
      }

      node.children.forEach(child => {
        visit(child);
      });

      selector.pop();
    }

    visit(styles);
    global_styles += rules.join('')
  }

  function parse_scoped_style_rules (sel) {
    let rules = [];
    let children = [];
    while (true) {
      if (peek('ident')) {
        let k = tok.data;
        next();
        if (peek('string')) {
          let v = parse_strict_string();
          rules.push([k, v]);
        } else {
          unexpected();
        }
      } else if (peek('string')) {
        let s = parse_strict_string();
        expect('[');
        children.push(parse_scoped_style_rules(s));
        expect(']');
      } else {
        break;
      }
    }
    return {
      sel: sel,
      rules: rules,
      children: children
    }
  }

  let class_id = 0;
  function rand_class () {
    return `adom-c-${class_id++}`;
  }

  function parse_custom_tag_body () {
    in_tag = true;
    parse_tag_list();
    in_tag = false;
  }

  function parse_tag() {
    let name = tok.data;
    expect("ident");
    let classlist = parse_class_list();
    let attr_data = parse_attributes();
    let events = attr_data[1];
    let attr = attr_data[0];
    if (classlist.data.length > 0) attr.class = classlist;
    let node = ast_node(_tag, {
      name: name,
      attributes: attr,
      events: events
    });
    let current = parent;
    parent = node;
    if (accept("[")) {
      parse_tag_list();
      expect("]");
    } else if (peek("string")) {
      let str = parse_string();
      ast_node(_textnode, str);
    } else {
      unexpected();
    }
    parent = current;
  }

  function parse_if_statement() {
    expect("(");
    let condition = parse_expr();
    expect(")");
    let current = parent;
    let node = ast_node(_if, condition);
    parent = node;
    let pass = ast_node(_block);
    parent = pass;
    if (accept("[")) {
      parse_tag_list();
      expect("]");
    } else {
      parse_tag();
    }
    if (accept("else")) {
      parent = node;
      let fail = ast_node(_block);
      parent = fail;
      if (accept("[")) {
        parse_tag_list();
        expect("]");
      } else if (accept("if")) {
        parse_if_statement();
      } else {
        parse_tag();
      }
    }
    parent = current;
  }

  function parse_tag_list() {
    if (accept("doctype")) {
      ast_node(_doctype, tok.data);
      expect("ident");
      parse_tag_list();
    } else if (accept("if")) {
      parse_if_statement();
      parse_tag_list();
    } else if (accept("each")) {
      expect("(");
      let it1, it0 = tok.data;
      expect("ident");
      if (accept(",")) {
        it1 = tok.data;
        expect("ident");
      }
      expect("in");
      let list = parse_expr();
      let node = ast_node(_each, {
        list: list,
        iterators: [it0, it1]
      });
      expect(")");
      let current = parent;
      parent = node;
      if (accept("[")) {
        parse_tag_list();
        expect("]");
      } else {
        parse_tag();
      }
      parent = current;
      parse_tag_list();
    } else if (peek("ident")) {
      parse_tag();
      parse_tag_list();
    } else if (peek("string")) {
      let str = parse_string();
      ast_node(_textnode, str);
      parse_tag_list();
    } else if (accept("yield")) {
      ast_node(_yield);
      parse_tag_list();
    } else if (in_tag && (peek('var') || peek('const'))) {
      parse_assignment();
      parse_tag_list();
    } else if (in_tag && accept('css')) {
      // make sure inside of at least 1 tag
      expect('[');
      let c = rand_class();
      let styles = parse_scoped_style_rules(`.${c}`);
      transform_to_css(styles);
      implicit_class = c;
      expect(']');
      parse_tag_list();
    }
  }

  function parse_custom_tag() {
    expect("tag");
    let tag = tok.data;
    let bind = accept('#');
    if (bind) tag = tok.data;
    expect("ident");
    expect("[");
    let node = ast_node(_custom, { name: tag, bind: bind });
    let current = parent;
    parent = node;
    parse_custom_tag_body();
    parent = current;
    expect("]");
  }

  function parse_strict_string () {
    expect('string');
    let data = tok.data;
    next();
    if (peek('{')) {
      throw_adom_error({
        msg: 'cannot interpolate here',
        pos: tok.pos,
        file: tok.file
      });
    }
    return data;
  }

  function parse_rhs (to_runtime) {
    let val;
    if (accept("file")) {
      // the file will be resolved to a string later
      val = { pos: tok.pos, file: tok.file, type: 'file', name: parse_strict_string() };
    } else {
      val = parse_expr();
    }
    return val;
  }

  function parse_assignment () {
    let isConst = (tok.data === 'const');
    if (in_tag && isConst) {
      throw_adom_error({ msg: 'cannot use const inside of a tag', pos: tok.pos, file: tok.file })
    }
    next();
    let dst = { data: tok.data, pos: tok.pos, file: tok.file };
    next();
    expect("=");
    let val = parse_rhs();
    ast_node(_set, {
      lhs: dst,
      rhs: val,
      const: isConst
    });
  }

  const parse_file = () => {
    while (true) {
      if (tok.type === "file_begin") {
        next();
      } else if (tok.type === "eof") {
        if (!next()) {
          break;
        }
      } else if (accept('import')) {
        let path = parse_strict_string();
        let fileData = this.openFile(path);
        let toks = this.tokenize(fileData[0], fileData[1]);
        let _ast = this.parse(toks, fileData[1]);
        runtime += _ast.data.runtime;
        global_styles += _ast.data.styles;
        delete _ast.data.runtime;
        delete _ast.data.styles;
        let node = ast_node(_file);
        node.children = _ast.children;
      } else if (accept("export")) {
        let id = tok.data;
        ast_node(_export, {
          name: id,
          pos: tok.pos,
          file: tok.file
        });
        expect("ident");
      } else if (tok.type === "ident" || tok.type === "doctype") {
        parse_tag_list();
      } else if (tok.type === "tag") {
        parse_custom_tag();
      } else if (peek('var') || peek('const')) {
        parse_assignment();
      } else if (peek('module_body')) {
        runtime += tok.data;
        next();
      } else {
        throw_adom_error({ msg: "unexpected: " + tok.type, pos: tok.pos, file: tok.file });
      }
    }
  }

  parse_file();

  ast.data.runtime = runtime;
  ast.data.styles = global_styles;

  return ast;
};

Adom.prototype.execute = function(ast, initial_state) {
  let html = "";
  let state = [initial_state];
  let file_ctx = [];

  // runtime_full = [
  //   `(function () {`,
  //   `  var $$adom_state = ${JSON.stringify(state)};`,
  //   `  ${adom_runtime}`,
  //   `  (function (${Object.keys(state).join(', ')}) {`,
  //     `  ${sync}`,
  //     `  ${t.user_runtime}`,
  //     `  $sync();`,
  //     `})(${Object.keys(state).map(k => `$$adom_state.${k}`).join(', ')})`,
  //   `})()`
  // ].join('\n');

  function push_ctx () {
    file_ctx.push({
      exports: [],
      custom_tags: {}
    });
  }

  function pop_ctx () {
    let ctx = file_ctx.pop();
    ctx.exports.forEach(e => {
      if (ctx.custom_tags[e]) {
        add_custom_tag(e, ctx.custom_tags[e]);
      }
    })
  }

  function add_export (e) {
    let ctx = file_ctx[file_ctx.length - 1];
    if (!ctx.custom_tags[e.name]) {
      throw_adom_error({ msg: 'undefined tag: ' + e.name, pos: e.pos, file: e.file });
    } else {
      ctx.exports.push(e.name);
    }
  }

  function add_custom_tag (n, t) {
    file_ctx[file_ctx.length - 1].custom_tags[n] = t;
  }

  function escapeHTML (txt) {
    return txt.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function assemble_attributes(attr) {
    return Object.keys(attr).map(function (k) {
      if (k === 'root') return '';
      let v = evaluate(attr[k]);
      if (v === false || v == null) return '';
      return ` ${k}="${Array.isArray(v) ? v.join(' ') : v}"`
    }).join('');
  }

  function evaluate(expr){
    switch (expr.type) {
      case 'null':
      case 'number':
      case 'bool':
      case 'chunk':
        return expr.data
      case 'string': {
        return expr.data.map(function (c) {
           return evaluate(c)
        }).join('');
      } break;
      case 'accumulator': {
        let v = expr.data[0];
        let prev = v.data;
        let ptr = evaluate(v);
        for (let i = 1; i < expr.data.length; i++) {
          v = expr.data[i];
          let str = evaluate(v);
          if (ptr[str] !== undefined) {
            prev = str;
            ptr = ptr[str];
          } else {
            throw_adom_error({ msg: str + ' is not a property of ' + prev, pos: v.pos, file: v.file });
          }
        }
        return ptr;
      } break;
      case 'ident': {
        let v = expr.data;
        let max = state.length - 1;
        for (let i = max; i >= 0; i--) {
          if (state[i][v] !== undefined) return state[i][v];
        }
        throw_adom_error({ msg: v + ' is undefined.', pos: expr.pos, file: expr.file });
      } break;
      case 'array': {
        return expr.data.map(evaluate);
      } break;
      case 'object': {
        let keys = Object.keys(expr.data);
        let obj = {};
        keys.forEach(function (k) {
          obj[k] = evaluate(expr.data[k]);
        });
        return obj;
      } break;
      case 'ternary': {
        let v = expr.data;
        return evaluate(v[0]) ? evaluate(v[1]) : evaluate(v[2]);
      } break;
      case 'comparison': {
        let v1 = evaluate(expr.data[0]);
        let v2 = evaluate(expr.data[1]);
        if (expr.op === '==') return v1 === v2;
        if (expr.op === '!=') return v1 !== v2;
        if (expr.op === '<=') return v1 <=  v2;
        if (expr.op === '>=') return v1 >=  v2;
        if (expr.op === '&&') return v1 &&  v2;
        if (expr.op === '||') return v1 ||  v2;
        if (expr.op === '>' ) return v1 >   v2;
        if (expr.op === '<' ) return v1 <   v2;
      } break;
      case 'parenthetical': {
        return evaluate(expr.data);
      } break;
    }
  }

  function end_script () {
    return ['<', '/', 'script', '>'].join('')
  }

  function children (r, y) {
    r.children.forEach(c => {
      walk(c, y);
    });
  }

  function eval_object (obj) {
    let ctx = {};
    Object.keys(obj).forEach(function(k) {
      ctx[k] = evaluate(obj[k]);
    });
    return ctx;
  }

  function set_state (dst, v) {
    let k = dst.data;
    let last = state[state.length - 1];
    if (last[k] === undefined) {
      last[k] = evaluate(v);
    } else {
      throw_adom_error({ msg: k + ' is already defined', pos: dst.pos, file: dst.file });
    }
  }

  function loop (data, fn) {
    let list = evaluate(data);
    if (Array.isArray(list)) {
      list.forEach((it, i) => {
        fn(it, i);
      })
    } else if (typeof list === 'object') {
      Object.keys(list).forEach(k => {
        fn(k, list[k]);
      });
    } else {
      throw_adom_error({ msg: data.data + ' is not iterable', pos: data.pos, file: data.file });
    }
  }

  function custom_tag (name) {
    return file_ctx[file_ctx.length - 1].custom_tags[name] || undefined;
  }

  function walk (r, yieldfn) {
    switch (r.type) {
      case _doctype: {
        html += '<!DOCTYPE html>';
        break;
      }
      case _tag: {
        let n = r.data.name;
        let t = custom_tag(n);
        if (t) {
          state.push({ props: eval_object(r.data.attributes) });
          children(t, function () {
            children(r, yieldfn);
          });
          state.pop();
          break;
        }
        html += `<${n}${assemble_attributes(r.data.attributes)}>`;
        if (void_tags.indexOf(n) === -1) {
          children(r, yieldfn);
          html += `</${n}>`;
        }
        break;
      }
      case _custom: {
        add_custom_tag(r.data.name, r);
        break;
      }
      case _textnode: {
        html += escapeHTML(evaluate(r.data));
        break;
      }
      case _set: {
        set_state(r.data.lhs, r.data.rhs);
        break;
      }
      case _if: {
        let pass = r.children[0];
        let fail = r.children[1];
        if (evaluate(r.data)) {
          children(pass, yieldfn);
        } else if (fail) {
          children(fail, yieldfn);
        }
        break;
      }
      case _each: {
        let i0 = r.data.iterators[0];
        let i1 = r.data.iterators[1];
        let scope = {};
        state.push(scope);
        loop(r.data.list, function (v0, v1) {
          scope[i0] = v0;
          if (i1) scope[i1] = v1;
          children(r, yieldfn);
        });
        state.pop();
        break;
      }
      case _yield: {
        if (yieldfn) yieldfn();
        break;
      }
      case _export: {
        add_export(r.data);
        break;
      }
      case _file: {
        push_ctx();
        children(r, yieldfn);
        pop_ctx();
        break;
      }
      default: {
        children(r, yieldfn);
        break;
      }
    }
  }

  walk(ast);

  return html;
};

Adom.prototype.print_error = function (err, str) {
  let prog = str || this.files[err.file];
  let index = err.pos;

  function get_line_info (index) {
    let i = 0, c = 1, last = 0;
    while (i < index) {
      if (prog[i++] === '\n') {
        last = i;
        c++;
      }
    }
    return { line: c, start: last, offset: index - last };
  }

  function line_text (start) {
    let i = start, line = '';
    while (prog[i] !== '\n' && i < prog.length) {
      line += prog[i++];
    }
    return line;
  }

  function line_to_pos (l) {
    let i = 0, count = 1;
    while (i < prog.length) {
      if (count === l) break;
      if (prog[i] === '\n') count++;
      i++;
    }
    return i;
  }

  function digit_count (num) {
    return num.toString().length;
  }

  let info = get_line_info(index);

  const red = '\x1b[31m';
  const dim = '\x1b[2m';
  const yellow = '\x1b[33m';
  const reset = '\x1b[0m';
  const bright = '\x1b[1m';

  console.log(`\n${red}Error: ${bright}${err.file}${reset}`);
  console.log(`\nLine ${info.line}:${info.offset}: ${yellow}${err.msg}${reset}\n`);
  console.log(`${dim}${info.line - 1}| ${reset}${line_text(line_to_pos(info.line - 1))}`);
  console.log(`${dim}${info.line}| ${reset}${line_text(info.start)}`);
  console.log(`${red}${'-'.repeat(digit_count(info.line) + 2 + info.offset)}^${reset}`);

  return [
    `\nError: ${err.file}`,
    `\nLine ${info.line}:${info.offset}: ${err.msg}\n`,
    `${info.line - 1}| ${line_text(line_to_pos(info.line - 1))}`,
    `${info.line}| ${line_text(info.start)}`,
    `${'-'.repeat(digit_count(info.line) + 2 + info.offset)}^`
  ].join('\n');
}

const adom_runtime = `
var $$processed = [];
var $$firstSync = true;
var $$props = [];

function $$push_props (props) {
  $$props.push(props);
}

function $$pop_props () {
  $$props.pop();
}

function $$addEventListeners (node, events) {
    var keys = Object.keys(events);
    keys.forEach(function (event) {
        node.addEventListener(event, events[event]);
    })
}

function $$if (cond, condIf, condElse) {
    if (cond) condIf();
    else condElse();
}

function $$each (list, fn) {
    if (Array.isArray(list)) {
        for (var i = 0; i < list.length; i++) {
            fn(list[i], i);
        }
    } else if (typeof list === 'object') {
        var keys = Object.keys(list);
        for (var i = 0; i < keys.length; i++) {
            fn(keys[i], list[keys[i]]);
        }
    } else {
        throw new Error(list + ' is not iterable');
    }
}

function $$clean (node) {
    var num = $$processed[$$processed.length - 1];
    while (node.childNodes[num]) {
        var out = node.childNodes[num];
        if (out.__adomState && out.__adomState.unmount) {
          out.__adomState.unmount();
        }
        node.removeChild(out);
    }
}

function $$create (type, props, events, state) {
    var node;
    if (type === 'text') node = document.createTextNode(props(state));
    else {
        node = document.createElement(type);
        $$attr(node, props(state));
    }
    if (state) {
      node.__adomState = state;
      if (state.mount) {
        state.mount();
      }
    }
    if (events) $$addEventListeners(node, events);
    return node;
}

function $$attr (node, props) {
    Object.keys(props).forEach(function (p) {
        var a = props[p];
        if (p === 'events') return;
        var v = a.constructor === Array ? a.join(' ') : a;
        if (p in node) {
            node[p] = v;
        } else if (v === false || v == null) {
            node.removeAttribute(at);
        } else {
            node.setAttribute(p, v);
        }
    });
}

function $$class (C, obj) {
  var i = new C();
  Object.keys(obj).forEach(function (k) {
    i[k] = obj[k];
  });
  return i;
}

function $$e (par, type, props, events, state, children) {
    var index = $$processed[$$processed.length - 1]++;
    var node = par.childNodes[index];
    if (!node) {
        node = $$create(type, props, events, state);
        par.appendChild(node);
    } else if (type === 'text' && node.nodeType === Node.TEXT_NODE) {
        node.nodeValue = props(node.__adomState || state);
    } else if (node.tagName && (type === node.tagName.toLowerCase())) {
        if (state && !node.__adomState) node.__adomState = state;
        $$attr(node, props(node.__adomState));
        if ($$firstSync && events) $$addEventListeners(node, events);
    } else {
        var out = node;
        node = $$create(type, props, events, state);
        if (out.__adomState && out.__adomState.unmount) {
          out.__adomState.unmount();
        }
        par.replaceChild(node, out);
    }
    if (children) {
        $$processed.push(0);
        children(node, node.__adomState || null);
        $$clean(node);
        $$processed.pop();
    }
}
`;

Adom.prototype.generate_sync = function (ast) {
  let sync_body = [];
  let prop_depth = -1;
  let custom_tags = {};
  let indents = 0;

  const sync_func = () => {
    return `
function $sync() {
    var par = window["adom-root-${this.uid}"];
    var $ = undefined;
    //console.time('sync');
    $$processed.push(0);
${sync_body.join('\n')}
    $$clean(par);
    $$processed.pop();
    //console.timeEnd('sync');
    $$firstSync = false;
 }
    `
  }

  function print_expression (expr) {
    switch (expr.type) {
      case 'ident':
      case 'null':
      case 'number':
      case 'bool':
        return expr.data.toString();
      case 'chunk':
        return `"${expr.data.replace(/"/g, '\\"').replace(/(\r\n|\n|\r)/gm, '\\n')}"`
      case 'string': {
        return `${expr.data.map(function (c) {
           return print_expression(c)
        }).join(' + ')}`;
      } break;
      case 'accumulator': {
        let val = print_expression(expr.data[0]);
        if (val === 'props') val = `$$props[${prop_depth}]`;
        for (let i = 1; i < expr.data.length; i++) {
          val += `[${print_expression(expr.data[i])}]`;
        }
        return val;
      } break;
      case 'array': {
        return `[${expr.data.map(function (i) {
          return print_expression(i);
        }).join(', ')}]`
      } break;
      case 'object': {
        let keys = Object.keys(expr.data);
        return `{ ${keys.map(function (k) {
          return `"${k}": ${print_expression(expr.data[k])}`;
        }).join(', ')} }`;
      } break;
      case 'ternary': {
        let v = expr.data;
        let v1 = print_expression(v[0]);
        let v2 = print_expression(v[1]);
        let v3 = print_expression(v[2]);
        return `(${v1} ? ${v2} : ${v3})`;
      } break;
      case 'comparison': {
        let v1 = print_expression(expr.data[0]);
        let v2 = print_expression(expr.data[1]);
        return `(${v1} ${expr.op} ${v2})`;
      } break;
      case 'parenthetical': {
        return `(${print_expression})`;
      } break;
    }
  }

  function stringify_object(obj) {
    return `{${Object.keys(obj).map((k, i) => `"${k}": ${print_expression(obj[k])}`).join(', ')}}`
  }

  function fmt() {
    return '    '.repeat(indents);
  }

  function expand (state, pref) {
    if (!state) return '';
    let k = Object.keys(state);
    let l = k.length;
    if (!pref) pref = '';
    return l === 1 ? (pref + k) : (l > 1 ? k.map(_k => pref + _k).join(',') : '');
  }

  function update (state, reverse) {
    if (!state) return '{}';
    let p1 = '$.', p2 = '';
    if (reverse) {
      p1 = '';
      p2 = '$.';
    }
    return '{ ' + Object.keys(state).map(k => `${p1}${k} = ${p2}${k}; `).join('') + '}';
  }

  function event (e, state) {
    let ex = expand(state, '$.'), r = false;
    if (e.handler.indexOf('this') !== -1) {
      r = true;
      ex = '';
    }
    return `"${e.type}": function ($e) { (function ($) { (function (${expand(state)}) { ${e.handler}; ${update(state, r)}; $sync(); }).call($${ex ? `, ${ex}`: ''}) })($e.target.__adomState || $); }`;
  }

  function event_object (events, state) {
    if (events.length) return `{${events.map(function (e) {
      return event(e, state);
    }).join(',')}}`;
    else return null;
  }

  function children (r, y) {
    r.children.forEach(c => {
      walk(c, y);
    });
  }

  function find_root (n) {
    if (n.type === _custom) {
      let t = { node: n, state: {}, bind: n.data.bind };
      n.children.forEach(c => {
        if (c.type === _set) {
          t.state[c.data.lhs.data] = c.data.rhs;
        }
      });
      custom_tags[n.data.name] = t;
    } else if (n.type === _tag && n.data.attributes.root) {
      return n;
    } else {
      for (let i = 0; i < n.children.length; i++) {
        let r = find_root(n.children[i]);
        if (r) return r;
      }
      return null;
    }
  }

  function walk (r, yieldfn) {
    switch (r.type) {
      case _tag: {
        let t = custom_tags[r.data.name];
        if (t) {
          for (let i = 0; i < t.node.children.length; i++) {
            if (t.node.children[i].type === _tag) {
              t.node.children[i].data.component = {
                bind: t.bind,
                state: t.state
              };
              break;
            }
          }
          sync_body.push(`${fmt()}$$push_props(${stringify_object(r.data.attributes)});`);
          prop_depth++;
          children(t.node, () => {
            children(r, yieldfn);
          });
          sync_body.push(`${fmt()}$$pop_props();`);
          prop_depth--;
        } else {
          let n = r.data.name;
          let state = null, tag_local = {};

          if (r.data.component) {
            let c = r.data.component;
            let s = Object.keys(c.state);
            tag_local = c.state;
            if (c.bind) {
              state = `$$class(${n}, ${s})`;
            } else {
              state = stringify_object(tag_local);
            }
          }

          let props = `function ($) { (function (${expand(tag_local)}) { return ${stringify_object(r.data.attributes)}; }).call($, ${expand(tag_local, '$.')}) }`;

          if (void_tags.indexOf(n) !== -1) {
            sync_body.push(`${fmt()}$$e(par, "${n}", ${props}, ${event_object(r.data.events)}, ${state});`);
          } else {
            sync_body.push(`${fmt()}$$e(par, "${n}", ${props}, ${event_object(r.data.events, tag_local)}, ${state}, function (par${tag_local ? `, $` : ''}) { (function (${expand(tag_local)}) {`)
          }
          indents++;
          children(r, yieldfn);
          indents--;
          sync_body.push(`${fmt()}})(${expand(tag_local, '$.')}); });`);
        }
        break;
      }
      case _textnode: {
        sync_body.push(`${fmt()}$$e(par, "text", function () { return ${print_expression(r.data)}; })`);
        break;
      }
      case _if: {
        sync_body.push(`${fmt()}$$if(${print_expression(r.data)}, function () {`);
        indents++;
        children(r.children[0]);
        indents--;
        if (r.children[1]) {
          sync_body.push(`${fmt()}}, function () {`);
          indents++;
          children(r.children[1]);
          indents--;
        }
        sync_body.push(`${fmt()}});`);
        break;
      }
      case _each: {
        let it = r.data.iterators;
        sync_body.push(`$$each(${print_expression(r.data.list)}, function (${it[0]}${it[1] ? `, ${it[1]}` : ''}) {`);
        indents++;
        children(r);
        indents--;
        sync_body.push(`});`);
        break;
      }
      case _yield: {
        if (yieldfn) yieldfn();
        break;
      }
      default: {
        children(r, yieldfn);
        break;
      }
    }
  }

  let root = find_root(ast);
  if (root) children(root);

  return sync_func();
};

Adom.prototype.getPath = function (p) {
  try {
    let path = require("path");
    return path.resolve(this.dirname, p);
  } catch (e) {
    return p;
  }
};

Adom.prototype.openFile = function(p) {
  let fs;

  try {
    fs = require("fs");
  } catch (e) {
    return ['', p]
  }

  let f = this.getPath(p);
  let t = fs.readFileSync(f).toString();

  this.files[f] = t;

  return [t, f];
};

Adom.prototype.render = function(file, input_state) {
  let html;
  try {
    let cacheKey = this.getPath(file);
    if (this.cache && this.opcode_cache[cacheKey]) {
      let cached = this.opcode_cache[cacheKey];
      return this.execute(cached.ops, input_state || {}, cached.sync);
    } else {
      let fileData = this.openFile(file);
      let f = fileData[1];
      let tokens = this.tokenize(fileData[0], f);
      let ast = this.parse(tokens);
      let sync = this.generate_sync(ast);
      let html = this.execute(ast, input_state);
      return html;
    }
  } catch (e) {
    if (e.origin === 'adom') {
      html = `<pre>${this.print_error(e)}</pre>`;
    } else {
      console.log(e);
    }
    return html;
  }
};

Adom.prototype.mount = function (sel, str) {
  try {
    // mount to dom
  } catch (e) {
    if (e.origin === 'adom') {
      document.querySelector(sel).innerHTML = '<pre>' + this.print_error(e, str) + '</pre>';
    } else {
      console.log(e);
    }
  }
};

return Adom;

})();

if (typeof module !== 'undefined') {
  module.exports = Adom
} else {
  window.Adom = Adom
}
