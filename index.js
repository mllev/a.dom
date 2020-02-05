var Adom = (function () {

let _c = 0;
const op_ = _c++;

function Adom(config) {
  config = config || {};
  this.opcode_cache = {};
  this.cache = config.cache || false;
  this.dirname = config.rootDir || "";
  this.runtimeTransform = config.runtimeTransform;
  this.files = {};
  this.uid = Math.floor(Math.random() * 10000);
}

function throw_adom_error (err) {
  err.origin = 'adom';
  throw err;
};

Adom.prototype.tokenize = function(prog, file, offset) {
  let cursor = 0,
    end_pos = prog.length - 1;
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
    "?",
    "@"
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
  let ops = [];
  let dont_emit = false;
  let yield_stack = [];
  let tag_scopes = [];
  let runtime = '';
  let root_found = false;
  let root_idx = -1;
  let in_tag = false;
  let implicit_class = undefined;
  let global_styles = '';

  function new_context() {
    files.push({
      tags: {},
      exports: []
    });
  }

  function get_custom_tag(name) {
    let t = files[files.length - 1].tags[name];
    if (!t && tag_scopes.length > 0) {
      t = tag_scopes[tag_scopes.length - 1].tags[name];
    }
    return t;
  }

  function emit(op, data) {
    if (dont_emit) return;
    let i = { type: op };
    if (data) i.data = data;
    ops.push(i);
    return ops.length - 1;
  }

  function next() {
    tok = tokens[++cursor];
  }

  function set_tok(i) {
    cursor = i - 1;
    next();
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

  function emit_textnode (d) {
    let o = ops[ops.length - 1]
    if (o && o.type === 'textnode') {
      o.data.data = o.data.data.concat(d);
    } else {
      emit("textnode", d);
    }
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
        if (!dont_emit) {
          if (root_found === true) {
            throw_adom_error({
              msg: 'root node already declared',
              pos: pos,
              file: file
            });
          }
          root_idx = ops.length;
          root_found = true;
          attr.id = { type: 'string', data: [{ type: 'chunk', data: `adom-root-${UID}` }] };
        }
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
        sync = false;
        events.push({ type: evt, handler: handler });
      } else {
        break;
      }
    }
    return [attr, events];
  }

  function end_tag(name, attr, events) {
    if (accept(";")) {
      emit("begin_tag", {
        name: name,
        self_close: true,
        attributes: attr,
        events: events
      });
    } else if (accept("[")) {
      emit("begin_tag", { name: name, attributes: attr, events: events });
      parse_tag_list();
      expect("]");
      emit("end_tag");
    } else if (peek("string")) {
      let str = parse_string();
      emit("begin_tag", { name: name, attributes: attr, events: events });
      if (str.data.length > 1 || str.data[0] !== '') {
        emit_textnode(str);
      }
      emit("end_tag");
    } else {
      unexpected();
    }
  }

  /*

  [ 
    { key: '', value: '' },
    { sel: 'selector', rules: [] }

    [
      rule1

      sel1 [
        rule2
      ]

      @media1 [
        rule3
      ]

      sel2 [
        rule4
        sel3 [
          rule5
          sel4 [
            rule6    
          ]
        ]

        @media2 [
          rule7
        ]
      ]
    ]

    .a1s2d3f4 { rule1 }
    .a1s2d3f4 sel1 { rule2 }
    .a1s2d3f4 sel2 { rule4 }
    .a1s2d3f4 sel2 sel3 { rule5 }
    .a1s2d3f4 sel2 sel3 sel4 { rule6 }
    @media1 { .a1s2d3f4 { rule3 } }
    @media2 { .a2s2d3f4 sel2 { rule7 } }
  ]
  */

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
      selector.push(node.sel);
      rules.push(`${create_selector(selector)} { ${ruleset} } `);

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
    let custom = get_custom_tag(name);
    if (classlist.data.length > 0) attr.class = classlist;
    if (custom && !dont_emit) {
      if (accept("[")) {
        let ret = cursor;
        dont_emit = true;
        parse_custom_tag_body();
        dont_emit = false;
        expect("]");
        let end_ret = cursor;
        set_tok(custom.pos);
        emit("begin_custom_tag", { name: name, props: attr, events: events, bind: custom.bind });
        tag_scopes.push(custom.scope);
        yield_stack.push(function(y) {
          set_tok(ret);
          parse_tag_list();
          expect("]");
          set_tok(y);
        });
        parse_custom_tag_body();
        yield_stack.pop();
        tag_scopes.pop();
        emit("end_custom_tag", name);
        set_tok(end_ret);
      } else {
        expect(";");
        let ret = cursor;
        set_tok(custom.pos);
        emit("begin_custom_tag", { name: name, props: attr, events: events });
        yield_stack.push(null);
        tag_scopes.push(custom.scope);
        parse_custom_tag_body();
        yield_stack.pop();
        tag_scopes.pop();
        emit("end_custom_tag", name);
        set_tok(ret);
      }
    } else {
      end_tag(name, attr, events);
    }
  }

  function parse_if_statement() {
    expect("(");
    let condition = parse_expr();
    expect(")");
    let op = emit("if", { condition: condition, jmp: 0 });
    if (accept("[")) {
      parse_tag_list();
      expect("]");
    } else {
      parse_tag();
    }
    let jmp = emit("jump", 0);
    if (!dont_emit) ops[op].data.jmp = ops.length - 1 - op;
    emit("else");
    if (accept("else")) {
      if (accept("[")) {
        parse_tag_list();
        expect("]");
      } else if (accept("if")) {
        parse_if_statement();
      } else {
        parse_tag();
      }
    }
    if (!dont_emit) ops[jmp].data = ops.length - 1 - jmp;
    emit("end_if");
  }

  function parse_tag_list() {
    let list;
    if (accept("doctype")) {
      expect("ident");
      emit("doctype");
      parse_tag_list();
    } else if (accept("if")) {
      parse_if_statement();
      parse_tag_list();
    } else if (accept("each")) {
      expect("(");
      let iter1,
        iter0 = tok.data;
      expect("ident");
      let op = emit("each", {});
      if (accept(",")) {
        iter1 = tok.data;
        expect("ident");
      }
      if (!dont_emit) ops[op].data.iterators = [iter0, iter1];
      expect("in");
      list = parse_expr();
      if (!dont_emit) ops[op].data.list = list;
      expect(")");
      if (accept("[")) {
        parse_tag_list();
        expect("]");
      } else {
        parse_tag();
      }
      // iterate back to one instruction after the each instruction
      emit("iterate", op - ops.length);
      if (!dont_emit) ops[op].data.jmp = ops.length - 1 - op;
      parse_tag_list();
    } else if (peek("ident")) {
      parse_tag();
      parse_tag_list();
    } else if (peek("string")) {
      let str = parse_string();
      if (str.data.length > 1 || str.data[0] !== '') {
        emit_textnode(str);
      }
      parse_tag_list();
    } else if (accept("yield")) {
      let y = yield_stack[yield_stack.length - 1];
      if (y) y(cursor);
      parse_tag_list();
    } else if (in_tag && (peek('var') || peek('const'))) {
      parse_assignment();
      parse_tag_list();
    } else if (in_tag && accept('css')) {
      // make sure inside of at least 1 tag
      expect('[');
      let c = rand_class();
      let styles = parse_scoped_style_rules(`.${c}`);
      if (!dont_emit) {
        transform_to_css(styles);
        implicit_class = c;
      }
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
    dont_emit = true;
    files[files.length - 1].tags[tag] = { pos: cursor, scope: files[files.length - 1], bind: bind };
    parse_custom_tag_body();
    dont_emit = false;
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
      let f = [];
      if (accept('[')) {
        while (true) {
          if (!peek('string')) break;
          f.push(parse_strict_string());
        }
        expect(']');
      } else {
        f.push(parse_strict_string());
      }
      pending.push({
        name: f,
        op: ops.length,
        runtime: to_runtime
      });
      // the file will be resolved to a string later
      val = { pos: tok.pos, file: tok.file };
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
    emit("set", { dst: dst, val: val, isConst: isConst });
  }

  function parse_file() {
    while (true) {
      if (tok.type === "file_begin") {
        new_context();
        next();
      } else if (tok.type === "eof") {
        let fctx = files.pop();
        fctx.exports.forEach(function(ex) {
          let e = ex.val;
          if (!fctx.tags[e])
            throw_adom_error({ msg: "no such tag", pos: ex.pos, file: ex.file });
          if (fctx.tags[e]) files[files.length - 1].tags[e] = fctx.tags[e];
        });
        if (files.length === 0) {
          break;
        } else {
          next();
        }
      } else if (accept("export")) {
        files[files.length - 1].exports.push({
          val: tok.data,
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
      } else if (accept('@')) {
        let id = tok.data;
        let pos = tok.pos;
        let file = tok.file;
        expect('ident');
        if (id !== 'runtime') {
          throw_adom_error({ msg: "unknown system variable: " + id, pos: pos, file: file });
        }
        expect('=');
        parse_rhs(true);
      } else {
        throw_adom_error({ msg: "unexpected: " + tok.type, pos: tok.pos, file: tok.file });
      }
    }
  }

  const openFileArray = (a) => {
    let txt = '';
    for (let i = 0; i < a.length; i++) {
      txt += this.openFile(a[i])[0];
    }
    return txt;
  }

  parse_file();

  for (let i = 0; i < pending.length; i++) {
    let file = pending[i];
    if (file.runtime) {
      runtime = openFileArray(file.name);
    } else {
      ops[file.op].data.val.type = 'string';
      ops[file.op].data.val.data = [ { type: 'chunk', data: openFileArray(file.name) } ];
    }
  }

  if (root_idx > -1) {
    ops[root_idx].data.is_root = true;
    ops[root_idx].data.runtime = runtime || ' ';
    ops[root_idx].data.styles = global_styles;
  }

  return ops;
};

Adom.prototype.execute = function(ops, initial_state, sync, mount) {
  let html = "";
  let ptr = 0;
  let state = initial_state;
  let open_tags = [];
  let pretty = false;
  let props = [];
  let iterators = [];
  let constVars = {};
  let runtime_full;
  let tag_locals = [];

  function escapeHTML (txt) {
    return txt.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function assemble_attributes(attr) {
    return Object.keys(attr).map(function (k) {
      if (k === 'events') return '';
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
        if (v === 'props') {
          return props[props.length - 1]
        }
        for (let i = iterators.length - 1; i >= 0; i--) {
          let it = iterators[i];
          if (it.iterators[0] === v) {
            return it.list[it.index];
          }
          if (it.iterators[1] === v) {
            return it.type === 'object' ?
              it.object[it.list[it.index]] : it.index;
          }
        }
        if (tag_locals.length && tag_locals[tag_locals.length - 1][v] !== undefined) return tag_locals[tag_locals.length - 1][v];
        if (state[v] !== undefined) return state[v];
        if (constVars[v] !== undefined) return constVars[v];
        throw_adom_error({ msg: v + ' is undefined.', pos: expr.pos, file: expr.file });
      } break;
      case 'array': {
        return expr.data.map(function (i) {
          return evaluate(i);
        })
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

  function fmt() {
    return pretty ? `\n${'    '.repeat(open_tags.length)}` : '';
  }

  function exec() {
    let iter;

    function current_tag () {
      return open_tags[open_tags.length - 1];
    }

    function end_script () {
      return ['<', '/', 'script', '>'].join('')
    }

    while (ptr < ops.length) {
      let op = ops[ptr++];
      switch (op.type) {
        case "doctype":
          html += '<!DOCTYPE html>';
          break;
        case "begin_tag":
          {
            if (op.data.styles) {
              html += `${fmt()}<style>${op.data.styles}</style>`;
            }
            html += `${fmt()}<${op.data.name}${assemble_attributes(op.data.attributes)}`;
            if (op.data.self_close) {
              html += ">"; // configure based on doctype
            } else {
              let a = op.data.attributes;
              html += ">";
              open_tags.push({
                name: op.data.name,
                user_runtime: op.data.runtime
              });
            }
          }
          break;
        case "end_tag":
          {
            let t = open_tags.pop();
            html += fmt() + "</" + t.name + ">";
            if (t.user_runtime) {
              runtime_full = `
(function () {
var $$adom_state = ${JSON.stringify(state)};
${adom_runtime}
(function (${Object.keys(state).join(', ')}) {
${sync}
${t.user_runtime}
$sync();
})(${Object.keys(state).map(k => `$$adom_state.${k}`).join(', ')})
})()
`
              if (!mount) html += `${fmt()}<script>${runtime_full}${end_script()}`;
            }
          }
          break;
        case "set":
          {
            let dst = op.data.dst;
            if (tag_locals.length > 0) {
              if (tag_locals[tag_locals.length - 1][dst.data] !== undefined) {
                throw_adom_error({ msg: dst.data + ' is already defined', pos: dst.pos, file: dst.file });
              }
              tag_locals[tag_locals.length - 1][dst.data] = evaluate(op.data.val);
            } else {
              if (constVars[dst.data] !== undefined || state[dst.data] !== undefined) {
                throw_adom_error({ msg: dst.data + ' is already defined', pos: dst.pos, file: dst.file });
              }
              if (op.data.isConst) {
                constVars[dst.data] = evaluate(op.data.val);
              } else {
                state[dst.data] = evaluate(op.data.val);
              }
            }
          }
          break;
        case "textnode":
          {
            if (current_tag().name === 'script') {
              html += fmt() + evaluate(op.data);
            } else {
              html += fmt() + escapeHTML(evaluate(op.data));
            }
          }
          break;
        case "begin_custom_tag":
          {
            let pctx = {};
            Object.keys(op.data.props).forEach(function(k) {
              pctx[k] = evaluate(op.data.props[k]);
            });
            props.push(pctx);
            tag_locals.push({});
          }
          break;
        case "end_custom_tag":
          {
            props.pop();
            tag_locals.pop();
          }
          break;
        case "if":
          {
            if (!evaluate(op.data.condition)) {
              ptr += op.data.jmp;
            }
          }
          break;
        case "jump":
          {
            ptr += op.data;
          }
          break;
        case "each":
          {
            let list = evaluate(op.data.list);
            if (Array.isArray(list)) {
              if (list.length === 0) {
                ptr += op.data.jmp;
                break;
              }
              iter = {
                type: "array",
                iterators: op.data.iterators,
                list: list,
                index: 0,
                data: {}
              };
              iter.data[op.data.iterators[0]] = list[0];
              if (op.data.iterators[1] != null)
                iter.data[op.data.iterators[1]] = 0;
              iterators.push(iter);
            } else if (typeof list === "object" && list !== null) {
              let keys = Object.keys(list);
              if (keys.length === 0) {
                ptr += op.data.jmp;
                break;
              }
              iter = {
                type: "object",
                list: keys,
                iterators: op.data.iterators,
                object: list,
                index: 0,
                data: {}
              };
              iter.data[op.data.iterators[0]] = keys[0];
              if (op.data.iterators.length > 1)
                iter.data[op.data.iterators[1]] = iter.object[iter.list[0]];
              iterators.push(iter);
            } else {
              throw_adom_error({
                msg: "each statements can only operate on arrays or objects",
                pos: op.data.list.pos,
                file: op.data.list.file
              });
            }
          }
          break;
        case "iterate":
          {
            iter = iterators[iterators.length - 1];
            if (iter.index < iter.list.length - 1) {
              if (iter.type === "array") {
                iter.data[iter.iterators[0]] = iter.list[++iter.index];
                if (iter.iterators[1] != null)
                  iter.data[iter.iterators[1]] = iter.index;
              } else {
                iter.data[iter.iterators[0]] = iter.list[++iter.index];
                if (iter.iterators[1] != null)
                  iter.data[iter.iterators[1]] =
                    iter.object[iter.data[iter.iterators[0]]];
              }
              ptr += op.data;
            } else {
              iterators.pop();
            }
          }
          break;
        default:
          break;
      }
    }
  }

  exec();

  if (mount) {
    return {
      html: html,
      runtime: runtime_full
    }
  } else {
    return html;
  }
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


Adom.prototype.generate_sync = function (ops, input_state) {
  let ptr = 0;
  let tags = [];
  let custom_tags = [];
  let sync_body = [];
  let prop_depth = -1;
  var tag_local = {};
  var do_bind = undefined;

  const UID = this.uid;

  function sync_func () {
    return `
function $sync() {
    var par = window["adom-root-${UID}"];
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

  function indents() {
    return '    '.repeat(tags.length);
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
      p2 = '$.'
    }
    return '{ ' + Object.keys(state).map(k => `${p1}${k} = ${p2}${k}; `).join('') + '}';
  }

  function event (e, state) {
    let ex = expand(state, '$.'), r = false;
    if (e.handler.indexOf('this') !== -1) {
      r = true;
      ex = '';
    }
    return `"${e.type}": function ($e) {  (function ($) { (function (${expand(state)}) { ${e.handler}; ${update(tags[tags.length - 1].state, r)}; $sync(); }).call($${ex ? `, ${ex}`: ''}) })($e.target.__adomState || $); }`;
  }

  function event_object (events, state) {
    if (events.length) return `{${events.map(function (e) {
      return event(e, state);
    }).join(',')}}`;
    else return null;
  }

  while (ptr < ops.length) {
    let op = ops[ptr++];
    switch (op.type) {
      case 'set': {
        if (custom_tags.length) {
          let k = op.data.dst.data;
          tag_local[k] = op.data.val;
        }
      } break;
      case "begin_tag":
        if (op.data.is_root) {
          tags.push({ name: op.data.name, root: true });
        } else if (tags.length) {
          let state = Object.keys(tag_local).length ? stringify_object(tag_local) : null;
          let new_state = !do_bind ? state : `$$class(${do_bind}, ${state})`;
          let props = `function ($) { return ${stringify_object(op.data.attributes)}; }`;
          if (op.data.self_close) {
            sync_body.push(`${indents()}$$e(par, "${op.data.name}", ${props}, ${event_object(op.data.events)}, ${new_state});`);
          } else {
            sync_body.push(`${indents()}$$e(par, "${op.data.name}", ${props}, ${event_object(op.data.events, tag_local)}, ${new_state}, function (par${state ? `, $` : ''}) { (function (${expand(tag_local)}) {`)
            tags.push({ name: op.data.name, state: tag_local });
          }
          if (state) {
            custom_tags[custom_tags.length - 1].locals = tag_local;
          }
          // both will get applied to the first element after the custom tag declaration
          // so it's cool to reset them here
          tag_local = {};
          do_bind = undefined;
        }
        break;
      case "end_tag":
        if (tags.length) {
          let t = tags.pop();
          if (!t.root) sync_body.push(`${indents()}})(${expand(t.state, '$.')}); });`);
        }
        break;
      case "textnode":
        if (tags.length) {
          sync_body.push(`${indents()}$$e(par, "text", function () { return ${print_expression(op.data)}; })`);
        }
        break;
      case "each":
        if (tags.length) {
          var it = op.data.iterators;
          sync_body.push(`${indents()}$$each(${print_expression(op.data.list)}, function (${it[0]}${it[1] ? `, ${it[1]}` : ''}) {`);
          tags.push({});
        }
        break;
      case "iterate":
        if (tags.length) {
          tags.pop();
          sync_body.push(`${indents()}});`);
        }
        break;
      case "begin_custom_tag":
        if (tags.length) {
          sync_body.push(`${indents()}$$push_props(${stringify_object(op.data.props)});`);
          if (op.data.bind) do_bind = op.data.name;
          custom_tags.push({ name: op, locals: {} });
          prop_depth++;
        }
        break;
      case "end_custom_tag":
        if (tags.length) {
          custom_tags.pop();
          prop_depth--;
          sync_body.push(`${indents()}$$pop_props();`);
          tag_local = {};
          do_bind = undefined;
        }
        break;
      case "if":
        if (tags.length) {
          sync_body.push(`${indents()}$$if(${print_expression(op.data.condition)}, function () {`);
          tags.push({});
        }
        break;
      case "else":
        if (tags.length) {
          tags.pop();
          sync_body.push(`${indents()}}, function () {`);
          tags.push({});
        }
        break;
      case "end_if":
        if (tags.length) {
          tags.pop();
          sync_body.push(`${indents()}});`);
        }
        break;
      default:
        break;
    }
  }

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

Adom.prototype.resolve_imports = function(tokens) {
  let out_toks = [];
  let ptr = 0;

  while (ptr < tokens.length) {
    switch (tokens[ptr].type) {
      case "import":
        {
          ptr+=2;
          let path = tokens[ptr].data;
          let fileData = this.openFile(path);
          let f = fileData[1];
          let toks = this.resolve_imports(this.tokenize(fileData[0], f), f);
          toks.forEach(function(t) {
            out_toks.push(t);
          });
        }
        break;
      default:
        out_toks.push(tokens[ptr]);
        break;
    }
    ptr++;
  }

  return out_toks;
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
      tokens = this.resolve_imports(tokens);
      let ops = this.parse(tokens);
      let sync = this.generate_sync(ops, input_state || {});
      html = this.execute(ops, input_state || {}, sync);
      if (this.cache) {
        this.opcode_cache[f] = { ops: ops, sync: sync };
      }
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
    let tokens = this.tokenize(str, 'main');
    tokens = this.resolve_imports(tokens);
    let ops = this.parse(tokens);
    let sync = this.generate_sync(ops, {}, true);
    let out = this.execute(ops, {}, sync, true);
    document.querySelector(sel).innerHTML = out.html;
    window.eval(out.runtime);
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
