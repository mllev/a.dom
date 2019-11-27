function Adom(config) {
  this.opcode_cache = {};
  this.cache = config.cache || false;
  this.dirname = config.rootDir || "";
  this.runtimeTransform = config.runtimeTransform;
  this.files = {};
}

Adom.prototype.tokenize = function(prog, file) {
  let cursor = 0,
    end_pos = prog.length - 1;
  let tokens = [{ type: "file_begin", data: file, pos: 0, file: file }];

  let keywords = [
    "tag",
    "doctype",
    "layout",
    "each",
    "if",
    "in",
    "else",
    "controller",
    "import",
    "yield",
    "on",
    "null",
    "export",
    "file",
    "var",
    "const",
    "def"
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
        let toks = this.tokenize(chunk, file);
        toks.shift(); //file_begin
        toks.pop(); //eof
        toks.forEach(function(t) {
          t.pos += pos;
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

  while (true) {
    let c = prog[cursor];
    let tok = { type: "", data: "", pos: cursor, file: file };

    if (cursor > end_pos) {
      tok.type = "eof";
      tokens.push(tok);
      break;
    } else if (c === " " || c === "\n" || c === "\t") {
      let i = cursor;
      while (
        i <= end_pos &&
        (prog[i] === " " || prog[i] === "\t" || prog[i] === "\n")
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
        c === "_" ||
        c === "-"
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
          throw { msg: "unterminated long string", pos: cursor, file: file };
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
      tok.data = str;
      tok.type = "string";
      cursor = i;
    } else if (c === '"' || c === "'") {
      let del = c;
      let i = cursor + 1;
      let text = '';

      while (true) {
        if (i > end_pos || prog[i] === "\n") {
          throw { msg: "unterminated string", pos: cursor, file: file };
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
      tokens.push({ type: 'string', pos: cursor, file: file });
      if (chunks.length > 1) {
        chunks.forEach(function(c) {
          tokens.push(c);
        });
      } else {
        tokens.push({ type: 'chunk', data: text, pos: cursor, file: file })
      }
      cursor = i;
      continue;
    } else if (
      c === "-" &&
      prog[cursor + 1] === ">"
    ) {
      let i = cursor + 2;
      while (i <= end_pos) {
        if (
          prog[i] === "\n" &&
          prog[i + 1] === "<" &&
          prog[i + 2] === "-"
        ) {
          i += 4;
          break;
        }
        tok.data += prog[i++];
      }
      if (i > end_pos) {
        throw { msg: "expected closing <-", pos: cursor, file: file };
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
  let ops = [];
  let dont_emit = false;
  let yield_stack = [];
  let tag_scopes = [];

  function new_context() {
    files.push({
      tags: {},
      modules: {},
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

  function get_module (name) {
    let t = files[files.length - 1].modules[name];
    if (!t && tag_scopes.length > 0) {
      t = tag_scopes[tag_scopes.length - 1].modules[name];
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
    throw { msg: "unexpected " + tok.type, pos: tok.pos, file: tok.file };
  }

  function expect(t) {
    if (tok.type === t) {
      next();
    } else {
      throw {
        msg: "expected: " + t + " found: " + tok.type,
        pos: tok.pos,
        file: tok.file
      };
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
    if (peek('number') || peek('bool')) {
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
        acc.unshift(expr);
        expr.type = 'accumulator';
        expr.data = acc;
      } else {
        expr = ex;
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

  function parse_textnode() {
    let chunks = [];
    while (true) {
      chunks.push(tok.data);
      expect("chunk");
      if (!accept("{")) break;
      chunks.push(parse_expr());
      expect("}");
    }
    return chunks;
  }

  function parse_class_list() {
    let classes = [];
    while (true) {
      if (!accept(".")) break;
      classes.push({
        type: "string",
        value: tok.data,
        pos: tok.pos,
        file: tok.file
      });
      expect("ident");
    }
    return {
      type: "array",
      value: classes
    };
  }

  function parse_attributes() {
    let attr = {};
    let events = [];
    while (true) {
      let key = tok.data;
      if (accept("controller")) {
        expect("=");
        if (accept("{")) {
          let pos = tok.pos;
          let file = tok.file;
          let mname = tok.data;
          let m = get_module(mname);
          expect("ident");
          if (!m && !dont_emit) {
            throw { msg: "unknown controller: " + mname, pos: pos, file: file };
          }
          expect("}");
          if (!dont_emit) {
            attr.controller = {
              name: m.name,
              body: m.body,
              deps: m.deps,
              pos: pos,
              file: file
            };
          }
        } else {
          let pos = tok.pos,
            file = tok.file;
          expect("string");
          throw {
            msg: "importing controllers is currently unsupported",
            pos: pos,
            file: file
          };
        }
      } else if (accept("ident")) {
        if (accept("=")) {
          if (accept("{")) {
            attr[key] = parse_expr();
            expect("}");
          } else if (peek("string")) {
            attr[key] = parse_string();
          } else {
            throw {
              msg: "unexpected " + tok.type,
              pos: tok.pos,
              file: tok.file
            };
          }
        } else {
          attr[key] = { type: "bool", data: true };
        }
      } else if (accept("on")) {
        expect(":");
        let evt = tok.data;
        expect("ident");
        expect("=");
        expect("{");
        let handler = tok.data
        expect("ident");
        expect("}");
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
      if (str.data.length > 1 || str.data[0] !== '')
        emit("textnode", str.data);
      emit("end_tag");
    } else {
      unexpected();
    }
  }

  function parse_tag() {
    let name = tok.data;
    expect("ident");
    let classlist = parse_class_list();
    let attr_data = parse_attributes();
    let events = attr_data[1];
    let attr = attr_data[0];
    let custom = get_custom_tag(name);
    if (classlist.value.length > 0) attr.class = classlist;
    if (custom && !dont_emit) {
      if (accept("[")) {
        let ret = cursor;
        dont_emit = true;
        parse_tag_list();
        dont_emit = false;
        expect("]");
        let end_ret = cursor;
        set_tok(custom.pos);
        emit("push_props", { props: attr, events: events });
	      tag_scopes.push(custom.scope);
	      yield_stack.push(function(y) {
          set_tok(ret);
          parse_tag_list();
          expect("]");
          set_tok(y);
        });
        parse_tag_list();
	      yield_stack.pop();
	      tag_scopes.pop();
        emit("pop_props");
        set_tok(end_ret);
      } else {
        expect(";");
        let ret = cursor;
        set_tok(custom.pos);
        emit("push_props", { props: attr, events: events });
	      yield_stack.push(null);
        tag_scopes.push(custom.scope);
        parse_tag_list();
	      yield_stack.pop();
        tag_scopes.pop();
        emit("pop_props");
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
      let type = tok.data;
      expect("ident");
      emit("doctype", type);
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
      if (str.data.length > 1 || str.data[0] !== '')
        emit("textnode", str.data);
      parse_tag_list();
    } else if (accept("yield")) {
      let y = yield_stack[yield_stack.length - 1];
      if (y) y(cursor);
      parse_tag_list();
    }
  }

  function parse_custom_tag() {
    expect("tag");
    let tag = tok.data;
    expect("ident");
    expect("[");
    dont_emit = true;
    files[files.length - 1].tags[tag] = { pos: cursor, scope: files[files.length - 1] };
    parse_tag_list();
    dont_emit = false;
    expect("]");
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
          if (!fctx.modules[e] && !fctx.tags[e])
            throw { msg: "no such tag or module", pos: ex.pos, file: ex.file };
          if (fctx.modules[e] && fctx.tags[e])
            throw { msg: "export is ambiguous", pos: ex.pos, file: ex.file };
          if (fctx.modules[e])
            files[files.length - 1].modules[e] = fctx.modules[e];
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
      	let isConst = (tok.data === 'const');
      	next();
        let dst = parse_variable();
        let val;
        expect("=");
        if (accept("file")) {
          val = parse_string();
        } else {
          val = parse_expr();
        }
        emit("set", { dst: dst, val: val, isConst: isConst });
      } else if (accept("def")) {
        let mname = tok.data;
        expect("ident");
        let deps = [];
        let pos = tok.pos, file = tok.file;
        if (accept('[')) {
          if (!accept(']')) {
            while (true) {
              deps.push(tok.data);
              expect('ident');
              if (!accept(',')) break;
            }
            expect(']');
          }
        }
        let module_body = tok.data;
        expect("module_body");
        deps.forEach(function (dep) {
          if (!files[files.length - 1].modules[dep]) {
            throw { msg: 'unknown module ' + dep, pos: pos, file: file };
          } else {
            let m = files[files.length - 1].modules[dep];
            emit('declare_module', {
              name: m.name,
              body: m.body,
              deps: m.deps
            });
          }
        });
        files[files.length - 1].modules[mname] = { name: mname, body: module_body, deps: deps };
      } else {
        throw { msg: "unexpected: " + tok.type, pos: tok.pos, file: tok.file };
      }
    }
  }

  parse_file();

  return ops;
};

Adom.prototype.execute = function(ops, initial_state) {
  let html = "";
  let ptr = 0;
  let state = initial_state;
  let open_tags = [];
  let pretty = false;
  let props = [];
  let iterators = [];
  let constVars = {};

  function check_props(list) {
    if (list[0] === "props") {
      if (props.length < 1)
        throw {
          msg: "props can only be used inside a custom tag",
          pos: pos,
          file: file
        };
      let v = props[props.length - 1];
      list.shift();
      return v;
    }
    return null;
  }

  function check_iterators(ptr, list) {
    let check = list[0];
    let i = iterators.length - 1;
    while (i >= 0) {
      if (iterators[i].data[check] != null) {
        list.shift();
        return iterators[i].data[check];
      }
      i--;
    }
    return ptr;
  }

  function resolve_variable(v) {
    let list = v.value.slice(0);
    let pos = v.pos;
    let file = v.file;
    let curr = state;

    if (constVars[list[0]]) curr = constVars;

    curr = check_props(list) || curr;
    curr = check_iterators(curr, list);

    list.forEach(function(k, i) {
      if (Array.isArray(k)) {
        k = resolve_variable({ value: k, pos: pos, file: file });
      }
      if (curr[k] != null) {
        curr = curr[k];
      } else {
        if (i > 0) {
          throw {
            msg: k + " is not a property of " + list[i - 1],
            pos: pos,
            file: file
          };
        } else {
          throw { msg: k + " is not defined", pos: pos, file: file };
        }
      }
    });
    return curr;
  }

  function set(dst, val, isConst) {
    let accessor = dst.value;
    let pos = dst.pos,
      file = dst.file;
    let ptr = isConst ? constVars : state;
    let max = accessor.length;
    let prev = undefined;

    for (let i = 0; i < max; i++) {
      let a = accessor[i];
      if (Array.isArray(a)) {
        a = resolve_variable({ value: a, pos: pos, file: file });
      }

      if (Array.isArray(ptr) && typeof a === "string") {
        throw { msg: prev + " is an array", pos: pos, file: file };
      }

      if (i === max - 1) {
        ptr[a] = get(val);
        return;
      }

      if (ptr[a] == null) {
        if (typeof accessor[i + 1] === "number") {
          ptr[a] = [];
        } else {
          ptr[a] = {};
        }
      } else {
        throw { msg: a + " is already declared", pos: pos, file: file }
      }

      ptr = ptr[a];
      prev = a;
    }
  }

  function resolve_ternary(v) {
    let v1 = v.value.data[0];
    let v2 = v.value.data[1];
    let v3 = v.value.data[2];
    let v4 = v.value.data[3];
    switch (v.value.cmp) {
      case "==":
        return get(v1) == get(v2) ? get(v3) : get(v4);
      case "!=":
        return get(v1) != get(v2) ? get(v3) : get(v4);
      case "<=":
        return get(v1) <= get(v2) ? get(v3) : get(v4);
      case ">=":
        return get(v1) >= get(v2) ? get(v3) : get(v4);
      case ">":
        return get(v1) > get(v2) ? get(v3) : get(v4);
      case "<":
        return get(v1) < get(v2) ? get(v3) : get(v4);
      default:
        return null;
    }
  }

  function get(v) {
    switch (v.type) {
      case "string":
      case "bool":
      case "number":
        return v.value;
      case "variable":
        return resolve_variable(v);
      case "object":
        {
          let obj = {};
          Object.keys(v.value).forEach(function(k) {
            obj[k] = get(v.value[k]);
          });
          return obj;
        }
        break;
      case "array":
        {
          return v.value.map(get);
        }
        break;
      case "ternary":
        {
          return resolve_ternary(v);
        }
        break;
    }
    return null;
  }

  function evaluate_condition(condition) {
    let lhs = get(condition.lhs);
    let rhs = get(condition.rhs);
    let cmp = condition.cmp;

    if (cmp === "==" && lhs == rhs) return true;
    if (cmp === "!=" && lhs != rhs) return true;
    if (cmp === "<=" && lhs <= rhs) return true;
    if (cmp === ">=" && lhs >= rhs) return true;
    if (cmp === "<" && lhs < rhs) return true;
    if (cmp === ">" && lhs > rhs) return true;

    return false;
  }

  function assemble_attributes(attr) {
    let str = "";
    Object.keys(attr).forEach(function(k) {
      if (k !== 'controller') {
	let v = get(attr[k]);
	if (Array.isArray(v)) v = v.join(" ");
	str += " " + k + '="' + v + '"';
      }
    });
    return str;
  }

  function assemble_textnode(chunks) {
    return chunks
      .map(function(chunk) {
        return typeof chunk === "string" ? chunk : get(chunk);
      })
      .join("");
  }

  function fmt() {
    return pretty
      ? "\n" +
          open_tags
            .map(function() {
              return "    ";
            })
            .join("")
      : "";
  }

  function exec() {
    let iter;
    let scope_depth = 0;
    let fragments = [];
    let controller = undefined;
    let following_textnode = false;

    function current_tag () {
      return open_tags[open_tags.length - 1];
    }

    function current_frag () {
      if (fragments.length > 0) {
	return fragments[fragments.length - 1];
      }
      return null;
    }

    while (ptr < ops.length) {
      let op = ops[ptr++];
      switch (op.type) {
        case "begin_tag":
          {
            html +=
              fmt() +
              "<" +
              op.data.name +
              assemble_attributes(op.data.attributes);
	    let f = current_frag();
	    if (f && current_tag().id === f.parent && scope_depth > 0) f.length++;
            if (op.data.self_close) {
              html += ">"; // configure based on doctype
	      following_textnode = false;
            } else {
	      let a = op.data.attributes;
	      let id = a['data-adom-id'];
              html += ">";
	      if (a.controller) controller = a.controller;
              open_tags.push({ name: op.data.name, id: id ? id.value : undefined, controller: a.controller });
            }
          }
          break;
        case "end_tag":
          {
            let t = open_tags.pop();
	    if (t.controller === controller) controller = undefined;
	    html += fmt() + "</" + t.name + ">";
	    following_textnode = false;
	    if (op.data) {
	      let frag_lengths = [];
	      fragments.forEach(function (f) {
		// the runtime relies on the order of the fragments initial lengths
		if (f.controller) frag_lengths.push(f.length);
	      })
	      html += fmt() + `<script id="adom-initial-frag-lengths" type="text/template">${JSON.stringify(frag_lengths)}</script>`;
	      html += fmt() + `<script id="adom-state" type="text/template">${JSON.stringify(state)}</script><script>${op.data}</script>`;
	    }
          }
          break;
        case "set":
          {
            set(op.data.dst, op.data.val, op.data.isConst);
          }
          break;
        case "textnode":
          {
	    let f = current_frag();
	    if (!following_textnode && f && current_tag().id === f.parent && scope_depth > 0) f.length++;
            html += fmt() + assemble_textnode(op.data);
	    following_textnode = true;
	  }
          break;
        case "push_props":
          {
            let pctx = {};
            Object.keys(op.data.props).forEach(function(k) {
              pctx[k] = get(op.data.props[k]);
            });
            props.push(pctx);
          }
          break;
        case "pop_props":
          {
            props.pop();
          }
          break;
        case "if":
          {
  	        scope_depth++;
      	    if (scope_depth === 1) {
      	      let t = current_tag();
      	      fragments.push({ parent: t.id, length: 0, controller: controller });
      	    }
            if (!evaluate_condition(op.data.condition)) {
              ptr += op.data.jmp;
            }
          }
          break;
        case "end_if":
          {
	    scope_depth--;
          }
          break;
        case "jump":
          {
            ptr += op.data;
          }
          break;
        case "each":
          {
	    scope_depth++;
	    if (scope_depth === 1) {
	      let t = current_tag();
	      fragments.push({ parent: t.id, length: 0, controller: controller });
	    }
            let list = get(op.data.list);
            if (Array.isArray(list)) {
              if (list.length === 0) {
                ptr += op.data.jmp;
		scope_depth--;
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
              throw {
                msg: "each statements can only operate on arrays or objects",
                pos: op.data.list.pos,
                file: op.data.list.file
              };
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
	      scope_depth--;
            }
          }
          break;
        default:
          break;
      }
    }
  }


  exec();

  return html;
};

Adom.prototype.get_error_text = function(prog, c) {
  let i = c;
  let buf = "",
    pad = "";
  let pos = c;
  let line = 1;
  while (pos >= 0) if (prog[pos--] === "\n") line++;
  buf += line + "| ";
  let np = line.toString().length + 2;
  for (let k = 0; k < np; k++) pad += " ";
  while (prog[i - 1] !== "\n" && i > 0) i--;
  while (prog[i] !== "\n" && i < prog.length) {
    if (i < c) {
      if (prog[i] === "\t") pad += "\t";
      else pad += " ";
    }
    buf += prog[i++];
  }
  buf += "\n" + pad + "^\n";
  return buf;
};

Adom.prototype.runtime = function (modules, controllers) {
  return `
function $adom () {
  this.frag_lengths = [];
  this.props = [];
}

$adom.prototype.push_props = function (obj) {
  this.props.push(obj);
  return [];
};

$adom.prototype.pop_props = function () {
  this.props.pop();
  return [];
};

$adom.prototype.id = function (id, all) {
  var a = document.querySelectorAll('[data-adom-id="' + id + '"]');
  return all ? a : a[0];
};

$adom.prototype.setAttributes = function (e, attr) {
  Object.keys(attr).forEach(function (a) {
    e.setAttribute(a, attr[a]);
  });
};

$adom.prototype.addEventListener = function (id, event, handler) {
  var elements = this.id(id, true);
  for (var i = 0; i < elements.length; i++) {
    var e = elements[i];
    if (!e.dataset['on' + event]) {
      e.dataset['on' + event] = true;
      e.addEventListener(event, handler);
    }
  }
};

$adom.prototype.if = function (cond, pass, fail) {
  var elements = [];
  var children;
  if (cond) {
    children = pass;
  } else {
    children = fail;
  }
  children.forEach(function (child) {
    if (Array.isArray(child)) {
      child.forEach(function (c) {
        elements.push(c);
      });
    } else {
      elements.push(child);
    }
  });
  return elements;
};

$adom.prototype.each = function (list, fn) {
  var elements = [];
  function addChildren (children) {
    children.forEach(function (child) {
      if (Array.isArray(child)) {
        child.forEach(function (c) {
          elements.push(c);
        })
      } else {
        elements.push(child);
      }
    })
  }
  if (Array.isArray(list)) {
    list.forEach(function (item, i) {
      var children = fn(item, i);
      addChildren(children);
    })
  } else if (typeof list === 'object') {
    var keys = Object.keys(list);
    keys.forEach(function (key) {
      var children = fn(key, list[key]);
      addChildren(children);
    })
  } else {
    throw new Error(list + ' is not iterable');
  }
  return elements;
};

$adom.prototype.el = function (tag, attributes, children) {
  if (tag === 'text') {
    return { type: 'text', text: attributes };
  }
  var els = [];
  children.forEach(function (child) {
    if (Array.isArray(child)) {
      child.forEach(function (c) {
        els.push(c);
      })
    } else {
      els.push(child);
    }
  });
  return {
    type: 'node',
    name: tag,
    attributes: attributes,
    children: els
  };
};

$adom.prototype.insertAtIndex = function (child, par, index) {
  if (index >= par.childNodes.length) {
    par.appendChild(child);
  } else {
    par.insertBefore(child, par.childNodes[index]);
  }
}

$adom.prototype.setText = function (id, text, index) {
  var el = this.id(id);
  var children = el.childNodes;
  if (index >= children.length) {
    el.appendChild(document.createTextNode(text));
  } else if (children[index].nodeType === Node.TEXT_NODE) {
    children[index].nodeValue = text;
  } else {
    this.insertAtIndex(document.createTextNode(text), el, index);
  }
};

$adom.prototype.insertFrag = function (elements, par, index, lidx) {
  var frag = document.createDocumentFragment();
  var prevLen = this.frag_lengths[lidx];
  var setAttr = this.setAttributes.bind(this);

  function walk (elements, par, domPtr) {
    elements.forEach(function (el) {
      var e;

      if (el.type === 'text') {
        e = document.createTextNode(el.text);
      } else {
        e = document.createElement(el.name);
        setAttr(e, el.attributes);
        if (el.children.length) {
          walk(el.children, e);
        }
      }
      par.appendChild(e);
    })
  }

  walk(elements, frag, par.childNodes[index]);

  for (var i = index; i < (index + prevLen); i++) {
    par.removeChild(par.childNodes[index]);
  }

  this.insertAtIndex(frag, par, index);

  return (this.frag_lengths[lidx] = elements.length);
};

var $$adom_modules = [];

${modules}

window.onload = function () {
  var $$adom_input_state = JSON.parse(window['adom-state'].innerHTML);
  var $$adom_initial_frag_lengths = JSON.parse(window['adom-initial-frag-lengths'].innerHTML);
  var $$adom_events = [];

  function $dispatch (event, data) {
    for (var i = 0; i < $$adom_events.length; i++) {
      if ($$adom_events[i].event === event) {
        $$adom_events[i].fn(data);
      }
    }
  }

  function $on (event, fn) {
    $$adom_events.push({ event: event, fn: fn });
  }

  ${controllers}
}
`
}

Adom.prototype.attach_runtime = function(ops, input_state, fn) {
  let ptr = 0;
  let in_controller = false;
  let prop_depth = -1;
  let iterators = [];
  let scope_depth = 0;
  let ids = 0;
  let updates = [];
  let events = [];
  let tag_info = [];
  let frag_index = 0;
  let frag_id = 0;
  let lindex = -1;
  let init = [];
  let controllers = [];
  let modules = [];
  let runtime_location = -1;
  let state_keys = Object.keys(input_state);
  let prop_events = undefined;

  function is_iterator(v) {
    for (let i = 0; i < iterators.length; i++) {
      if (iterators[i].indexOf(v) !== -1) {
        return true;
      }
    }
    return false;
  }

  function get_value(v) {
    switch (v.type) {
      case "bool":
        return v.value.toString();
      case "chunk":
      case "string":
        return '"' + v.value + '"';
      case "number":
        return v.value;
      case "variable":
        let start = 0;
        let val = v.value;
        let variable = "";
        if (is_iterator(val[0])) {
          variable = "";
        } else if (val[0] === "props") {
          variable = "adom.props[" + prop_depth + "]";
          start = 1;
        }
        for (let i = start; i < val.length; i++) {
          let part = val[i];
          if (i === 0) variable += part;
          else if (typeof part === "number") variable += "[" + part + "]";
          else variable += '["' + part + '"]';
        }
        return variable;
      case "array":
        return "[" + v.value.map(get_value).join(", ") + "]";
      case "ternary":
        let d = v.value.data;
        return `(${get_value(d[0])})${v.value.cmp}(${get_value(d[1])})?(${get_value(d[2])}):(${get_value(d[3])})`
      default:
        if (typeof v === "string") return '"' + v + '"';
        return '""';
    }
  }

  function get_content(chunks) {
    return (
      "(" +
      chunks
        .map(function(chunk) {
          return get_value(chunk);
        })
        .join(" + ") +
      ")"
    );
  }

  function stringify_object(obj) {
    let keys = Object.keys(obj);
    return (
      "{" +
      keys
        .map(function(k, i) {
          return '"' + k + '": ' + get_value(obj[k]);
        })
        .join(", ") +
      "}"
    );
  }

  function last_tag (index) {
    return tag_info[tag_info.length - (index || 1)]
  }

  function get_frag_index (t) {
    let index = '';
    for (let i = 0; i < t.frag_count - 1; i++) {
      index += `offs${t.id}${i} + `;
    }
    index += frag_index;
    return index;
  }

  while (ptr < ops.length) {
    let op = ops[ptr++];
    switch (op.type) {
      case 'set': {
	      if (!op.data.isConst)
	        state_keys.push(op.data.dst.value[0]);
      } break;
      case "declare_module": {
        modules.push(op.data);
      } break;
      case "begin_tag":
        if (op.data.attributes.controller) {
          let c = op.data.attributes.controller;
          let id = ids++;
          op.data.attributes['data-adom-id'] = { type: 'string', value: id + "" };
          tag_info.push({ name: op.data.name, ref: op, count: 0, frag_count: 0, id: id })
          if (in_controller) {
            throw {
              msg: "nested controllers are illegal",
              pos: c.pos,
              file: c.file
            };
          }
          in_controller = true;
          controllers.push(c);
	        op.data.attributes.controller = c.name;
        } else if (in_controller) {
          let id = ids++
          op.data.attributes['data-adom-id'] = { type: 'string', value: id + "" };
          tag_info.push({ name: op.data.name, ref: op, count: 0, frag_count: 0, id: id })
          if (op.data.events.length > 0) {
            op.data.events.forEach(function(e) {
              events.push({ id: id, event: e.type, handler: e.handler });
            });
          }
          if (prop_events) {
	          // events on custom tags are attached to the first child of the tag
            prop_events.forEach(function(e) {
              events.push({ id: id, event: e.type, handler: e.handler });
            });
	          prop_events = undefined;
          }
          if (scope_depth === 0) {
            last_tag(2).count++;
            let needsUpdates = false
            let obj = {}
            for (let a in op.data.attributes) {
              let attr = op.data.attributes[a]
              let t = attr.type
              if (t === 'array' || t === 'variable' || t === 'array') {
                if (t === 'variable') {
                  if (state_keys.indexOf(attr.value[0]) > -1) {
                    needsUpdates = true
                    obj[a] = op.data.attributes[a]
                  }
                } else {
                  needsUpdates = true
                  obj[a] = op.data.attributes[a]
                }
              }
            }
            if (needsUpdates) {
              updates.push(`adom.setAttributes(adom.id('${id}'),${stringify_object(obj)});`);
            }
            if (op.data.self_close) {
              tag_info.pop()
            }
          } else {
            updates.push(`adom.el("${op.data.name}", ${stringify_object(op.data.attributes)}, [`);
            if (op.data.self_close) {
              updates.push(']),')
              tag_info.pop()
            }
          }
        }
        break;
      case "end_tag":
        if (in_controller) {
          tag_info.pop()
          if (scope_depth > 0) {
            updates.push(']),')
          }
          if (!tag_info.length) {
            let c = controllers[controllers.length - 1];
            c.updates = updates;
            c.init = init;
            c.events = events;
            controller = undefined;
            in_controller = false;
            events = [];
            updates = [];
            init = [];
            runtime_location = ptr - 1;
            frag_index = 0;
            frag_id = 0;
            lindex = -1;
          }
        }
        break;
      case "textnode":
        if (in_controller) {
          let parent = last_tag();
          if (scope_depth === 0) {
            let i = parent.count++;
            let id = parent.id;
            let needsUpdates = false
            op.data.forEach(function (c) {
              if (c.type === 'variable' && state_keys.indexOf(c.value[0]) > -1) {
                needsUpdates = true
              }
            })
            if (needsUpdates) {
              updates.push(`adom.setText("${id}", ${get_content(op.data)}, ${i});`);
            }
          } else {
            updates.push(`adom.el("text", ${get_content(op.data)}),`);
          }
        }
        break;
      case "each":
        if (in_controller) {
          let c = op.data;
          let i = c.iterators;
          iterators.push(i);
          if (scope_depth === 0) {
            lindex++;
            let t = last_tag() 
            frag_id = t.frag_count++;
            frag_index = t.count
            updates.push(
              `var frag${t.id}${frag_id} = adom.each(${get_value(op.data.list)}, function(${i[0]}${
                i[1] ? `, ${i[1]}` : ''
              }) { return [`
            )
          } else {
            updates.push(
              `adom.each(${get_value(op.data.list)}, function(${i[0]}${
                i[1] ? `, ${i[1]}` : ''
              }) { return [`
            )
          }
          scope_depth++;
        }
        break;
      case "iterate":
        if (in_controller) {
          iterators.pop();
          scope_depth--;
          if (scope_depth === 0) {
            init.push(`adom.frag_lengths.push($$adom_initial_frag_lengths.shift());`)
            updates.push(`] });`);
            let t = last_tag();
            let id = t.id;
            let index = get_frag_index(t);
            updates.push(`var offs${t.id}${frag_id} = adom.insertFrag(frag${t.id}${frag_id}, adom.id('${id}'),${index},${lindex});`);
          } else {
            updates.push(`] }),`);
          }
        }
        break;
      case "push_props":
        if (in_controller) {
          if (scope_depth === 0) {
            updates.push(`adom.push_props(${stringify_object(op.data.props)});`);
          } else {
            updates.push(`adom.push_props(${stringify_object(op.data.props)}),`);
          }
	  prop_events = op.data.events;
          prop_depth++;
        }
        break;
      case "pop_props":
        if (in_controller) {
          if (scope_depth === 0) {
            updates.push(`adom.pop_props();`);
          } else {
            updates.push(`adom.pop_props(),`);
          }
          prop_depth--;
        }
        break;
      case "if":
        if (in_controller) {
          let c = op.data.condition;
          if (scope_depth === 0) {
            lindex++;
            let t = last_tag();
            frag_id = t.frag_count++;
            frag_index = t.count;
            let v1 = get_value(c.lhs);
            let v2 = get_value(c.rhs);
            updates.push(`var frag${t.id}${frag_id} = adom.if((${v1})${c.cmp}(${v2}), [`)
          } else {
            updates.push(`adom.if((${v1})${c.cmp}(${v2}), [`)
          }
          scope_depth++;
        }
        break;
      case "else":
        if (in_controller) {
          updates.push('],[');
        }
        break;
      case "end_if":
        if (in_controller) {
          scope_depth--;
          if (scope_depth === 0) {
            init.push(`adom.frag_lengths.push($$adom_initial_frag_lengths.shift());`)
            updates.push(']);')
            let t = last_tag();
            let id = t.id;
            let index = get_frag_index(t);
            updates.push(`var offs${t.id}${frag_id} = adom.insertFrag(frag${t.id}${frag_id}, adom.id('${id}'),${index},${lindex});`);
          } else {
            updates.push(']),')
          }
        }
        break;
      default:
        break;
    }
  }

  let moduleCode = '';
  let controllerCode = '';

  modules.forEach(function (m) {
    moduleCode += `
$$adom_modules.${m.name} = (function () {
  ${m.body}
})(${m.deps.map(function (d) {
  return `$$adom_modules.${d}`
}).join(',')});`;
  });

  controllers.forEach(function (c) {
    controllerCode += `
(function ${c.name} (${c.deps.join(',')}) {
  var adom = new $adom();
  var $ = JSON.parse(JSON.stringify($$adom_input_state));

  ${c.init.join('\n')}

  (function (${state_keys.join(',')}) {
    function $addEventListeners () {
      ${c.events.map(function (e) {
        return `adom.addEventListener("${e.id}", "${e.event}", ${e.handler});`
      }).join('\n')}
    }

    function $sync () {
      ${c.updates.join('\n')}
        $addEventListeners();
    }

    function $call () {
      var args = Array.clice.call(arguments);
      var fn = args.shift(); fn.apply(null, args);
      $sync();
    }

    $addEventListeners();
    ${c.body}
  })(${state_keys.map(function (k) {
    return `$.${k}`; 
  }).join(',')});
})(${c.deps.map(function (d) {
  return `$$adom_modules.${d}`;
}).join(',')});
    `    
  });

  if (runtime_location > -1) {
    let r = this.runtime(moduleCode, controllerCode);
    if (this.runtimeTransform) {
      r = this.runtimeTransform(r);
    }
    ops[runtime_location].data = r;
  }
};

Adom.prototype.getPath = function (p) {
  let path = require("path");
  return path.resolve(this.dirname, p);
};

Adom.prototype.openFile = function(p) {
  let fs = require("fs");
  let f = this.getPath(p);
  let prog = fs.readFileSync(f).toString();
  this.files[f] = prog;
  return [prog, f];
};

Adom.prototype.resolve_imports = function(tokens, file) {
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
      case "file": {
        ptr += 2;
        let path = tokens[ptr].data;
        let fileData = this.openFile(path);
        out_toks.push({
          type: "string",
          pos: tokens[ptr].pos,
          file: tokens[ptr].file
        });
        out_toks.push({
          type: "chunk",
          data: fileData[0],
          pos: tokens[ptr].pos,
          file: tokens[ptr].file
        });
      } break;
      default:
        out_toks.push(tokens[ptr]);
        break;
    }
    ptr++;
  }

  return out_toks;
};

Adom.prototype.render = function(file, input_state) {
  try {
    let cacheKey = this.getPath(file);
    if (this.cache && this.opcode_cache[cacheKey]) {
      return this.execute(this.opcode_cache[cacheKey], input_state || {});
    } else {
      let fileData = this.openFile(file);
      let f = fileData[1];
      let tokens = this.tokenize(fileData[0], f);
      tokens = this.resolve_imports(tokens, f);
      let ops = this.parse(tokens);
      console.log(JSON.stringify(ops, null, 2));
      return '';
      this.attach_runtime(ops, input_state || {});
      let html = this.execute(ops, input_state || {});
      if (this.cache) {
        this.opcode_cache[f] = ops;
      }
      return html;
    }
  } catch (e) {
    if (e.pos != null) {
      console.log("Error: ", e.file);
      console.log(e.msg);
      console.log(this.get_error_text(this.files[e.file], e.pos));
    } else if (e.msg) {
      console.log(e.msg);
    } else {
      console.log(e);
    }
    return "";
  }
};

module.exports = Adom;
