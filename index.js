function Adom(config) {
  this.opcode_cache = undefined;
  this.cache = config.cache || false;
  this.dirname = config.root || "";
  this.files = {};
}

Adom.prototype.tokenize = function(prog, file) {
  let cursor = 0,
    end_pos = prog.length - 1;
  let tokens = [{ type: "file_begin", data: file, pos: 0, file: file }];

  let keywords = [
    "tag",
    "module",
    "doctype",
    "layout",
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
    "controller",
    "and",
    "or"
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
      if (text[i] === "{" && in_expr === false) {
        in_expr = true;
        chunks.push({ type: "chunk", data: chunk, pos: pos, file: file });
        chunk = "{";
        i++;
        pos = cursor + i;
      } else if (text[i] === "}" && in_expr === true) {
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
        i++;
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
    } else if (c === "|") {
      let i = cursor + 1;
      let text = "";
      while (true) {
        if (i > end_pos) {
          throw { msg: "unterminated text node", pos: cursor, file: file };
        }

        if (prog[i] === "|") {
          i++;
          break;
        }
        text += prog[i++];
      }
      let chunks = break_into_chunks.call(this, text, cursor);
      chunks.forEach(function(c) {
        tokens.push(c);
      });
      cursor = i;
      continue;
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

      while (true) {
        if (i > end_pos || prog[i] === "\n") {
          throw { msg: "unterminated string", pos: cursor, file: file };
        }
        if (prog[i] === del) {
          i++;
          break;
        }
        if (prog[i] === "\\" && prog[i + 1] === del) {
          tok.data += prog[i + 1];
          i += 2;
        }
        tok.data += prog[i++];
      }

      tok.type = "string";
      cursor = i;
    } else if (
      c === "-" &&
      prog[cursor + 1] === "-" &&
      prog[cursor + 2] === ">"
    ) {
      let i = cursor + 3;
      while (i <= end_pos) {
        if (
          prog[i] === "\n" &&
          prog[i + 1] === "<" &&
          prog[i + 2] === "-" &&
          prog[i + 3] === "-"
        ) {
          i += 4;
          break;
        }
        tok.data += prog[i++];
      }
      if (i > end_pos) {
        throw { msg: "expected closing <--", pos: cursor, file: file };
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

  function new_context() {
    files.push({
      tags: {},
      modules: {},
      exports: []
    });
  }

  function get_custom_tag(name) {
    let t = files[files.length - 1].tags[name];
    return t == null ? -1 : t;
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

  function is_primitive() {
    return peek("string") || peek("number") || peek("bool");
  }

  function parse_primitive() {
    let value = tok.data;
    let type = tok.type;
    let pos = tok.pos;
    let file = tok.file;
    if (!accept("string") && !accept("number") && !accept("bool")) {
      unexpected();
    }
    return { type: type, value: value, pos: pos, file: file };
  }

  function parse_variable() {
    let value = [tok.data];
    let pos = tok.pos;
    let file = tok.file;
    expect("ident");
    while (true) {
      if (accept(".")) {
        value.push(tok.data);
        expect("ident");
      } else if (accept("[")) {
        value.push(parse_variable_or_primitive().value);
        expect("]");
      } else {
        break;
      }
    }
    return { type: "variable", value: value, pos: pos, file: file };
  }

  function parse_variable_or_primitive() {
    if (is_primitive()) {
      return parse_primitive();
    } else if (peek("ident")) {
      return parse_variable();
    } else {
      unexpected();
    }
  }

  function parse_comparison() {
    return (
      accept("==") ||
      accept("!=") ||
      accept("<=") ||
      accept(">=") ||
      accept(">") ||
      accept("<")
    );
  }

  function parse_variable_primitive_or_ternary() {
    let data = [parse_variable_or_primitive()];
    let cmp = tok.type;
    if (parse_comparison()) {
      data.push(parse_variable_or_primitive());
      expect("?");
      data.push(parse_variable_or_primitive());
      expect(":");
      data.push(parse_variable_or_primitive());
      return { type: "ternary", value: { cmp: cmp, data: data } };
    } else {
      return data[0];
    }
  }

  function parse_object() {
    let obj = {};
    expect("{");
    while (true) {
      let key = tok.data;
      expect("ident");
      expect(":");
      if (peek("[")) {
        obj[key] = parse_array();
      } else if (peek("{")) {
        obj[key] = parse_object();
      } else {
        obj[key] = parse_variable_or_primitive();
      }
      if (!accept(",")) break;
    }
    expect("}");
    return { type: "object", value: obj };
  }

  function parse_array() {
    let arr = [];
    expect("[");
    while (true) {
      if (peek("[")) {
        arr.push(parse_array());
      } else if (peek("{")) {
        arr.push(parse_object());
      } else {
        arr.push(parse_variable_or_primitive());
      }
      if (!accept(",")) break;
    }
    expect("]");
    return { type: "array", value: arr };
  }

  function parse_textnode() {
    let chunks = [];
    while (true) {
      chunks.push(tok.data);
      expect("chunk");
      if (!accept("{")) break;
      chunks.push(parse_variable_or_primitive());
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
          let pos = tok.pos,
            file = tok.file;
          let tname = tok.data;
          let ctrlr = files[files.length - 1].modules[tname];
          expect("ident");
          if (!ctrlr) {
            throw { msg: "unknown controller: " + tname, pos: pos, file: file };
          }
          expect("}");
          attr.controller = {
            name: tname,
            body: ctrlr,
            pos: pos,
            file: file
          };
        } else {
          let cfile = tok.data;
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
            if (peek("[")) {
              attr[key] = parse_array();
            } else {
              attr[key] = parse_variable_primitive_or_ternary();
            }
            expect("}");
          } else if (peek("string")) {
            attr[key] = { type: "string", value: tok.data };
            next();
          } else {
            throw {
              msg: "unexpected " + tok.type,
              pos: tok.pos,
              file: tok.file
            };
          }
        } else {
          attr[key] = { type: "bool", value: true };
        }
      } else if (accept("on")) {
        expect(":");
        let evt = tok.data;
        expect("ident");
        expect("(");
        let handler = tok.data;
        expect("ident");
        expect(")");
        events.push({ type: evt, handler: handler });
      } else {
        break;
      }
    }
    return [attr, events];
  }

  function end_tag(name, attr, events, yield_func) {
    if (accept(";")) {
      emit("begin_tag", {
        name: name,
        self_close: true,
        attributes: attr,
        events: events
      });
    } else if (accept("[")) {
      emit("begin_tag", { name: name, attributes: attr, events: events });
      parse_tag_list(yield_func);
      expect("]");
      emit("end_tag");
    } else if (peek("chunk")) {
      let textnode = parse_textnode();
      emit("begin_tag", { name: name, attributes: attr, events: events });
      emit("textnode", textnode);
      emit("end_tag");
    } else {
      unexpected();
    }
  }

  function parse_tag(yield_func) {
    let name = tok.data;
    expect("ident");
    let classlist = parse_class_list();
    let attr_data = parse_attributes();
    let events = attr_data[1];
    let attr = attr_data[0];
    let custom = get_custom_tag(name);
    if (classlist.value.length > 0) attr.class = classlist;
    if (custom > -1 && !dont_emit) {
      if (accept("[")) {
        let ret = cursor;
        dont_emit = true;
        parse_tag_list();
        dont_emit = false;
        expect("]");
        let end_ret = cursor;
        set_tok(custom);
        emit("push_props", attr);
        parse_tag_list(function(y) {
          set_tok(ret);
          parse_tag_list(yield_func);
          expect("]");
          set_tok(y);
        });
        emit("pop_props");
        set_tok(end_ret);
      } else {
        expect(";");
        let ret = cursor;
        set_tok(custom);
        emit("push_props", attr);
        parse_tag_list(yield_func);
        emit("pop_props");
        set_tok(ret);
      }
    } else {
      end_tag(name, attr, events, yield_func);
    }
  }

  function parse_conditional() {
    let cond = {};
    while (true) {
      cond.lhs = parse_variable_or_primitive();
      cond.cmp = tok.type;
      if (!parse_comparison()) {
        throw {
          msg: "expected comparison operator",
          pos: tok.pos,
          file: tok.file
        };
      }
      cond.rhs = parse_variable_or_primitive();
      if (accept("or")) {
        continue;
      } else if (accept("and")) {
        continue;
      } else {
        break;
      }
    }
    return cond;
  }

  function parse_if_statement(yield_func) {
    expect("(");
    let condition = parse_conditional();
    expect(")");
    let op = emit("if", { condition: condition, jmp: 0 });
    if (accept("[")) {
      parse_tag_list(yield_func);
      expect("]");
    } else {
      parse_tag(yield_func);
    }
    let jmp = emit("jump", 0);
    if (!dont_emit) ops[op].data.jmp = ops.length - 1 - op;
    emit("else");
    if (accept("else")) {
      if (accept("[")) {
        parse_tag_list(yield_func);
        expect("]");
      } else if (accept("if")) {
        parse_if_statement(yield_func);
      } else {
        parse_tag(yield_func);
      }
    }
    if (!dont_emit) ops[jmp].data = ops.length - 1 - jmp;
    emit("end_if");
  }

  function parse_tag_list(yield_func) {
    let list;
    if (accept("doctype")) {
      let type = tok.data;
      expect("ident");
      emit("doctype", type);
      parse_tag_list(yield_func);
    } else if (accept("if")) {
      parse_if_statement(yield_func);
      parse_tag_list(yield_func);
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
      if (peek("[")) {
        list = parse_array();
      } else {
        list = parse_variable();
      }
      if (!dont_emit) ops[op].data.list = list;
      expect(")");
      expect("[");
      parse_tag_list(yield_func);
      expect("]");
      // iterate back to one instruction after the each instruction
      emit("iterate", op - ops.length);
      if (!dont_emit) ops[op].data.jmp = ops.length - 1 - op;
      parse_tag_list(yield_func);
    } else if (peek("ident")) {
      parse_tag(yield_func);
      parse_tag_list(yield_func);
    } else if (peek("chunk")) {
      parse_textnode();
      parse_tag_list();
    } else if (accept("yield")) {
      if (yield_func) yield_func(cursor);
      parse_tag_list(yield_func);
    }
  }

  function parse_custom_tag() {
    expect("tag");
    let tag = tok.data;
    expect("ident");
    expect("[");
    dont_emit = true;
    files[files.length - 1].tags[tag] = cursor;
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
      } else if (accept("$")) {
        let dst = parse_variable();
        let val;
        expect("=");
        if (accept("file")) {
          expect("string");
        } else {
          if (peek("[")) {
            val = parse_array();
          } else if (peek("{")) {
            val = parse_object();
          } else {
            val = parse_variable_or_primitive();
          }
        }
        emit("set", { dst: dst, val: val });
      } else if (accept("module")) {
        let module = tok.data;
        expect("ident");
        let module_body = tok.data;
        expect("module_body");
        files[files.length - 1].modules[module] = module_body;
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
  let pretty = true;
  let props = [];
  let iterators = [];

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

  function set(dst, val) {
    let accessor = dst.value;
    let pos = dst.pos,
      file = dst.file;
    let ptr = state;
    let max = accessor.length;
    let prev = undefined;

    for (let i = 0; i < max; i++) {
      let a = accessor[i];
      if (Array.isArray(a)) {
        a = resolve_variable({ value: a, pos: pos, file: file });
      }
      let t = typeof ptr[a];

      if (Array.isArray(ptr) && typeof a === "string") {
        throw { msg: prev + " is an array", pos: pos, file: file };
      }

      if (i === max - 1) {
        ptr[a] = get(val);
        return;
      }

      if (t === "string" || t === "number") {
        throw {
          msg:
            a +
            " is a " +
            t +
            " and cannot be accessed like an array or object",
          pos: pos,
          file: file
        };
      }

      if (ptr[a] == null) {
        if (typeof accessor[i + 1] === "number") {
          ptr[a] = [];
        } else {
          ptr[a] = {};
        }
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
      let v = get(attr[k]);
      if (Array.isArray(v)) v = v.join(" ");
      str += " " + k + '="' + v + '"';
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

    while (ptr < ops.length) {
      let op = ops[ptr++];
      switch (op.type) {
        case "begin_tag":
          {
            if (op.data.module) {
              html +=
                fmt() +
                "<script>" +
                op.data.module[0] +
                JSON.stringify(state) +
                op.data.module[1] +
                "</script>";
            }
            html +=
              fmt() +
              "<" +
              op.data.name +
              assemble_attributes(op.data.attributes);
            if (op.data.self_close) {
              html += ">"; // configure based on doctype
            } else {
              html += ">";
              open_tags.push(op.data.name);
            }
          }
          break;
        case "end_tag":
          {
            let tagname = open_tags.pop();
            html += fmt() + "</" + tagname + ">";
          }
          break;
        case "set":
          {
            set(op.data.dst, op.data.val);
          }
          break;
        case "textnode":
          {
            html += fmt() + assemble_textnode(op.data);
          }
          break;
        case "push_props":
          {
            let pctx = {};
            Object.keys(op.data).forEach(function(k) {
              pctx[k] = get(op.data[k]);
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
            if (!evaluate_condition(op.data.condition)) {
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
            let list = get(op.data.list);
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

Adom.prototype.runtime = function(config) {
  return [
    `
// name, state, rootNode, nodeTree, events, module
window.addEventListener('load', function ${config.name} () {
  // create node tree from state
  let $$adom_state = `,
    // state will get inserted here during the execution step
    // because it may get modified there
    `
  let $$adom_props = []
  let $$adom_events = undefined
  let $$adom_prev_tree = undefined

  function $$adom_flatten (arr) {
    let nodes = []
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
    let c = children ? $$adom_flatten(children) : undefined
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
    let nodes = []

    list.forEach(function (item, i) {
      nodes = nodes.concat($$adom_flatten(children(item, i)))
    })

    return nodes
  }

  function $$adom_if (cond, ifChildren, elseChildren) {
    if (cond) {
      return $$adom_flatten(ifChildren)
    } else if (elseChildren) {
      return $$adom_flatten(elseChildren)
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
      let c = node.content.trim()
      if (c) {
        let t = document.createElement('div')
        t.innerHTML = c
        return t.childNodes[0]
      }
      return document.createTextNode('')
    }
    let el = document.createElement(node.type)
    Object.keys(node.attributes).forEach(function (attr) {
      el.setAttribute(attr, node.attributes[attr])
    })
    return el
  }

  function $$adom_create_dom_tree (nodes) {
    let rootNode = document.createDocumentFragment()
    function walk (children) {
      let prev
      children.forEach(function (node) {
        let el = $$adom_create_node(node)
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
    let root_node = $$adom_select('[data-adom-id="${config.root}"]')[0]
    let nodes = $$adom_create_node_tree()
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
  `
  ];
};

Adom.prototype.resolve_modules = function(ops) {
  let ptr = 0;
  let ids = 0;
  let tag_count = 0;
  let in_controller = false;
  let controller = undefined;
  let node_tree = "";
  let events = [];
  let prop_depth = -1;
  let iterators = [];

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
        return !!v.value;
      case "chunk":
      case "string":
        return '"' + v.value + '"';
      case "number":
        return v.value;
      case "variable":
        let start = 0;
        let val = v.value;
        let variable = "$$adom_state.";
        if (is_iterator(val[0])) {
          variable = "";
        } else if (val[0] === "props") {
          variable = "$$adom_props[" + prop_depth + "]";
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
        return (
          "(" +
          get_value(d[0]) +
          ")" +
          v.value.cmp +
          "(" +
          get_value(d[1]) +
          ")?(" +
          get_value(d[1]) +
          "):(" +
          get_value(d[2]) +
          ")"
        );
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

  while (ptr < ops.length) {
    let op = ops[ptr++];
    switch (op.type) {
      case "begin_tag":
        if (op.data.attributes.controller) {
          let c = op.data.attributes.controller;
          if (in_controller) {
            throw {
              msg: "nested controllers are illegal",
              pos: c.pos,
              file: c.file
            };
          }
          let id = ids++;
          controller = {
            body: c.body,
            ptr: ptr - 1,
            root: id,
            name: c.name
          };
          tag_count++;
          in_controller = true;
          delete op.data.attributes.controller;
        } else if (in_controller) {
          if (op.data.events.length > 0) {
            let id = ids++;
            op.data.attributes["data-adom-id"] = { type: "number", value: id };
            op.data.events.forEach(function(e) {
              events.push({
                sel: '[data-adom-id="' + id + '"]',
                event: e.type,
                handler: e.handler
              });
            });
          }
          let attr = stringify_object(op.data.attributes);
          if (op.data.self_close) {
            node_tree +=
              '$$adom_element("' + op.data.name + '", ' + attr + "),";
          } else {
            node_tree +=
              '$$adom_element("' + op.data.name + '", ' + attr + ", [";
            tag_count++;
          }
        }
        break;
      case "end_tag":
        if (in_controller) {
          tag_count--;
          if (tag_count === 0) {
            let o = ops[controller.ptr];
            let eventstr =
              "[" +
              events
                .map(function(e) {
                  return (
                    "{sel: '" +
                    e.sel +
                    "', event: '" +
                    e.event +
                    "', handler: " +
                    e.handler +
                    "}"
                  );
                })
                .join(",") +
              "]";
            o.data.attributes["data-adom-id"] = {
              type: "number",
              value: controller.root
            };
            o.data.module = this.runtime({
              nodes: node_tree,
              name: controller.name,
              root: controller.root,
              module: controller.body,
              events: eventstr
            });
            controller = undefined;
            in_controller = false;
            node_tree = "";
          } else {
            node_tree += "]),";
          }
        }
        break;
      case "textnode":
        if (in_controller) {
          node_tree +=
            '$$adom_element("textnode", ' + get_content(op.data) + "),";
        }
        break;
      case "each":
        if (in_controller) {
          let c = op.data;
          if (c.iterators.length > 1) {
            node_tree +=
              "$$adom_each(" +
              get_value(c.list) +
              ", function(" +
              c.iterators[0] +
              ", " +
              c.iterators[1] +
              "){ return [";
          } else {
            node_tree +=
              "$$adom_each(" +
              get_value(c.list) +
              ", function(" +
              c.iterators[0] +
              "){ return [";
          }
          iterators.push(c.iterators);
        }
        break;
      case "iterate":
        if (in_controller) {
          node_tree += "]; }),";
          iterators.pop();
        }
        break;
      case "push_props":
        if (in_controller) {
          prop_depth++;
          node_tree += "$$adom_push_props(" + stringify_object(op.data) + "),";
        }
        break;
      case "pop_props":
        if (in_controller) {
          prop_depth--;
          node_tree += "$$adom_pop_props(),";
        }
        break;
      case "if":
        if (in_controller) {
          let c = op.data.condition;
          node_tree +=
            "$$adom_if(" + get_value(c.lhs) + c.cmp + get_value(c.rhs) + ", [";
        }
        break;
      case "else":
        if (in_controller) {
          node_tree += "], [";
        }
        break;
      case "end_if":
        if (in_controller) {
          node_tree += "]),";
        }
        break;
      default:
        break;
    }
  }
  return ops;
};

Adom.prototype.openFile = function(p) {
  let fs = require("fs");
  let path = require("path");
  let f = path.resolve(this.dirname, p);
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
          let path = tokens[++ptr].data;
          let fileData = this.openFile(path);
          let f = fileData[1];
          let toks = this.resolve_imports(this.tokenize(fileData[0], f), f);
          toks.forEach(function(t) {
            out_toks.push(t);
          });
        }
        break;
      case "file":
        let path = tokens[++ptr].data;
        let fileData = this.openFile(path);
        out_toks.push({
          type: "string",
          data: fileData[0],
          pos: tokens[ptr].pos,
          file: tokens[ptr].file
        });
        break;
      default:
        out_toks.push(tokens[ptr]);
        break;
    }
    ptr++;
  }

  return out_toks;
};

Adom.prototype.compile_file = function(file, input_state) {
  try {
    if (this.cache && this.opcode_cache) {
      return this.execute(this.opcode_cache, input_state || {});
    } else {
      let fileData = this.openFile(file);
      let f = fileData[1];
      let tokens = this.resolve_imports(this.tokenize(fileData[0], f), f);
      let ops = this.resolve_modules(this.parse(tokens));
      let html = this.execute(ops, input_state || {});
      if (this.cache) {
        this.opcode_cache = ops;
      }
      return html;
    }
  } catch (e) {
    if (e.pos) {
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
