var Adom = (function () {
  const _file = 0;
  const _export = 1;
  const _doctype = 2;
  const _if = 3;
  const _each = 4;
  const _tag = 5;
  const _custom = 6;
  const _yield = 7;
  const _textnode = 8;
  const _set = 9;
  const _block = 10;

  function Adom (config = {}) {
    this.ast_cache = {};
    this.cache = config.cache || false;
    this.dirname = config.root || "";
    this.runtimeFilter = config.runtimeFilter;
    this.filters = Object.assign(default_filters, config.filters || {});
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

  const default_filters = {
    json: function (text) {
      return JSON.parse(text);
    }
  };

  const void_tags = [
    "area",
    "base",
    "basefont",
    "bgsound",
    "br",
    "col",
    "command",
    "embed",
    "frame",
    "hr",
    "image",
    "img",
    "input",
    "isindex",
    "keygen",
    "link",
    "menuitem",
    "meta",
    "nextid",
    "param",
    "source",
    "track",
    "wbr"
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
      "export",
      "file",
      "var",
      "const",
      "let",
      "root",
      "nosync",
      "repeat",
      "filter",
      "map",
      "as"
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
      "|",
      "+",
      "/",
      "-",
      "*",
      "%",
      "!",
      "@"
    ];

    function is_newline (c) {
      return c == '\n' || c == '\r'
    }

    // amazing
    // https://stackoverflow.com/a/32567789
    function is_letter (c) {
      return c.toLowerCase() != c.toUpperCase();
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
          chunk = "{{";
          i+=2;
          pos = cursor + i;
        } else if (text[i] === "}" && text[i+1] === "}" && in_expr === true) {
          in_expr = false;
          chunk += "}}";
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
      } else if (c === '-' && prog[cursor + 1] === '>') {
        cursor+=2;
        tok.type = '->';
        tok.data = '->';
      } else if (c === "/" && prog[cursor + 1] === "/") {
        let i = cursor;
        while (c !== "\n" && i <= end_pos) c = prog[++i];
        cursor = i;
        continue;
      } else if (c >= "0" && c <= "9") {
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
      } else if (
        (c === '-' && prog[cursor+1] === '-' && is_letter(prog[cursor+2])) ||
        is_letter(c) || c === '_'
      ){
        let i = cursor;
        tok.data = "";
        while (
          c &&
          (is_letter(c) ||
          (c >= "0" && c <= "9") ||
          (c === "_") ||
          (c === "-"))
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
          tok.type = "null";
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
      } else if (c === "-" && prog[cursor + 1] === "-") {
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
        tok.type = "js_context";
      } else if (symbols.indexOf(c) !== -1) {
        tok.type = c;
        tok.data = c;
        cursor++;
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
    let runtime = '';
    let root_found = false;
    let in_tag = false;
    let ast = new ASTNode(_file, { file: tok.file });
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

    function get_dir (path) {
      let dir = path.split('/');
      dir.pop();
      return dir.join('/');
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
          expect('{');
          data.push(parse_expr());
          expect('}');
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

    function parse_atom () {
      let unop = tok.data;
      let expr = { pos: tok.pos, file: tok.file };
      if (accept('!') || accept('-')) {
        return {
          type: 'unop',
          op: unop,
          data: parse_atom(),
          pos: tok.pos,
          file: tok.file
        };
      }
      if (peek('number') || peek('bool') || peek('null')) {
        expr.type = tok.type;
        expr.data = tok.data;
        next();
      } else if (peek('string')) {
        expr = parse_string();
      } else if (peek('ident')) {
        expr = {
          pos: tok.pos,
          file: tok.file,
          type: 'ident',
          data: tok.data
        };
        next();
      } else if (accept('(')) {
        expr = {
          type: 'parenthetical',
          data: parse_expr(),
          pos: expr.pos,
          file: expr.file
        };
        expect(')');
      } else if (peek('{')) {
        expr.type = 'object';
        expr.data = parse_object();
      } else if (peek('[')) {
        expr.type = 'array';
        expr.data = parse_array();
      } else {
        unexpected();
      }
      let acc = parse_acc();
      if (acc) {
        acc.unshift(expr);
        return {
          type: 'accumulator',
          data: acc,
          pos: expr.pos,
          file: expr.file
        };
      }
      return expr
    }

    function get_precendence (op) {
      return {
        '||': 1,
        '&&': 2,
        '==': 3,
        '!=': 3,
        '<=': 4,
        '>=': 4,
        '>':  4,
        '<':  4,
        '+':  5,
        '-':  5,
        '*':  6,
        '/':  6,
        '%':  6 
      }[op] || null;
    }

    function parse_expr1 (min_prec) {
      let expr = parse_atom();

      while (true) {
        let op = tok.data;
        let prec = get_precendence(op);

        if (!prec || prec < min_prec) {
          break;
        }

        next();

        expr = {
          type: 'binop',
          op: op,
          data: [expr, parse_expr(prec + 1)]
        };
      }

      if (min_prec < 1 && accept('?')) {
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

    function parse_lambda () {
      let args = [];
      expect('[');
      args.push(tok.data);
      expect('ident');
      if (accept(',')) {
        args.push(tok.data);
        expect('ident');
      }
      expect('->');
      let expr = parse_expr();
      expect(']');
      return {
        type: 'lambda',
        args: args,
        expr: expr
      }
    }

    function parse_expr (min_prec) {
      if (min_prec == null) min_prec = 0;
      let expr = parse_expr1(min_prec);
      while (true) {
        if (accept('filter')) {
          expr = {
            type: 'filter',
            data: [expr, parse_lambda()]
          };
        } else if (accept('map')) {
          expr = {
            type: 'map',
            data: [expr, parse_lambda()]
          };
        } else {
          break;
        }
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
          if (accept('repeat')) {
            let expr = parse_expr();
            let count = tok.data;
            expect('number');
            for (let i = 0; i < count; i++) {
              arr.push(expr);
            }
          } else {
            arr.push(parse_expr());
          }
          if (!accept(",")) break;
        }
      }
      expect("]");
      return arr;
    }

    function parse_class_list() {
      let classes = [];
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
          // allow ':' in attribute names
          while (accept(':')) {
            key += ':'
            key += tok.data;
            expect('ident');
          }
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
          let nosync = accept('nosync');
          events.push({ type: evt, handler: handler, sync: !nosync });
        } else {
          break;
        }
      }
      return [attr, events];
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
      let possible_id = undefined;
      if (classlist.data.length > 0) {
        possible_id = { namespace: name, name: classlist.data[0].data[0].data };
        if (attr.class) {
          if (attr.class.type === 'array') {
            attr.class.data = classlist.data.concat(attr.class.data); 
          } else {
            classlist.data.push(attr.class);
            attr.class = classlist; 
          }
        } else {
          attr.class = classlist;
        }
      }
      let node = ast_node(_tag, {
        name: name,
        attributes: attr,
        events: events,
        possible_id: possible_id
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

    const parse_tag_list = () => {
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
      } else if (in_tag && (peek('var') || peek('const') || peek('let'))) {
        parse_assignment();
        parse_tag_list();
      }
    }

    function parse_custom_tag() {
      expect("tag");
      let tag = tok.data;
      let pos = tok.pos, file = tok.file;
      let bind = accept('#');
      if (bind) tag = tok.data;
      expect("ident");
      expect("[");
      let node = ast_node(_custom, { name: tag, bind: bind, pos: pos, file: file });
      let current = parent;
      parent = node;
      parse_custom_tag_body();
      parent = current;
      expect("]");
      return tag;
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

    function parse_rhs () {
      let val;
      if (accept("file")) {
        // the file will be resolved to a string later
        val = {
          pos: tok.pos,
          file: tok.file,
          type: 'file',
          name: parse_strict_string(),
          dir: get_dir(tok.file)
        };
        if (accept('|')) {
          val.filter = { name: tok.data, pos: tok.pos, file: tok.file };
          expect('ident');
        }
      } else {
        val = parse_expr();
      }
      return val;
    }

    function parse_assignment () {
      next();
      let dst = { data: tok.data, pos: tok.pos, file: tok.file };
      next();
      expect("=");
      let val = parse_rhs();
      ast_node(_set, {
        lhs: dst,
        rhs: val
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
          let dir = get_dir(tok.file);
          let file = this.openFile(path, dir);
          let toks = this.tokenize(file.text, file.name);
          let _ast = this.parse(toks, file.name);
          let ns = null;
          if (accept('as')) {
            ns = tok.data;
            expect('ident');
          }
          let node = ast_node(_file, Object.assign(_ast.data, { namespace: ns }));
          node.children = _ast.children;
        } else if (accept("export")) {
          let id, pos = tok.pos;
          let file = tok.file;
          if (peek('tag')) {
            id = parse_custom_tag();
          } else {
            id = tok.data;
            expect('ident');
          }
          ast_node(_export, {
            name: id,
            pos: pos,
            file: file
          });
        } else if (tok.type === "ident" || tok.type === "doctype") {
          parse_tag_list();
        } else if (peek("tag")) {
          parse_custom_tag();
        } else if (peek('var') || peek('const') || peek('let')) {
          parse_assignment();
        } else if (peek('js_context')) {
          runtime += tok.data;
          next();
        } else {
          throw_adom_error({ msg: "unexpected: " + tok.type, pos: tok.pos, file: tok.file });
        }
      }
    }

    parse_file();

    ast.data.runtime = runtime;

    return ast;
  };

  Adom.prototype.execute = function(ast, initial_state, mount) {
    let html = "";
    let state = [initial_state];
    let file_ctx = [];

    function runtime () {
      return [
        !mount ? `window.onload = function () {` : `(function () {`,
        `  var $$adom_state = ${JSON.stringify(state[0])};`,
        `  ${adom_runtime}`,
        `  (function (${Object.keys(state[0]).join(', ')}) {`,
        `    var $sync = function () {};`,
        `${ast.data.runtime}`,
        `    $sync();`,
        `})(${Object.keys(state[0]).map(k => `$$adom_state.${k}`).join(', ')});`,
        !mount ? `};` : `})();`
      ].join('\n');
    }

    function push_ctx (ns) {
      file_ctx.push({
        exports: [],
        custom_tags: {},
        namespaces: {},
        namespace: ns
      });
    }

    function pop_ctx () {
      let ctx = file_ctx.pop();
      if (!file_ctx.length) return;
      ctx.exports.forEach(e => {
        if (ctx.custom_tags[e.name]) {
          add_custom_tag(e, ctx.custom_tags[e.name], ctx.namespace);
        }
      })
    }

    function add_export (e) {
      let ctx = file_ctx[file_ctx.length - 1];
      if (!ctx.custom_tags[e.name]) {
        throw_adom_error({ msg: 'undefined tag: ' + e.name, pos: e.pos, file: e.file });
      } else {
        ctx.exports.push({ name: e.name, pos: e.pos, file: e.file });
      }
    }

    function add_custom_tag (e, t, ns) {
      let ctx = file_ctx[file_ctx.length - 1];
      if (ns) {
        if (!ctx.namespaces[ns]) ctx.namespaces[ns] = {};
        ctx.namespaces[ns][e.name] = t;
      } else {
        if (ctx.custom_tags[e.name]) {
          throw_adom_error({ msg: 'duplicate tag: ' + e.name, pos: e.pos, file: e.file });
        }
        ctx.custom_tags[e.name] = t;
      }
    }

    function escapeHTML (txt) {
      return txt.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function assemble_attributes(attr) {
      return Object.keys(attr).map(function (k) {
        if (k === 'root' || k === 'innerHTML') return '';
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
        case 'unop': {
          let v = evaluate(expr.data);
          if (expr.op === '-') return -v;
          if (expr.op === '!') return !v;
        } break;
        case 'binop': {
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
          if (expr.op === '+') return v1 + v2;
          if (expr.op === '-') return v1 - v2;
          if (expr.op === '*') return v1 * v2;
          if (expr.op === '/') return v1 / v2;
          if (expr.op === '%') return v1 % v2;
        } break;
        case 'parenthetical': {
          return evaluate(expr.data);
        } break;
        case 'filter':
        case 'map': {
          let s = {};
          let a = evaluate(expr.data[0]);
          let l = expr.data[1];
          l.args.forEach(a => s[a] = true);
          state.push(s);
          a = a[expr.type]((...args) => {
            l.args.forEach((a, i) => s[a] = args[i]);
            return evaluate(l.expr);
          });
          state.pop();
          return a;
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
        });
      } else if (typeof list === 'object') {
        Object.keys(list).forEach(k => {
          fn(k, list[k]);
        });
      } else {
        throw_adom_error({ msg: data.data + ' is not iterable', pos: data.pos, file: data.file });
      }
    }

    function custom_tag (name, nsid) {
      let ctx = file_ctx[file_ctx.length - 1];
      if (nsid) {
        let ns = ctx.namespaces[nsid.namespace];
        if (ns && ns[nsid.name]) return ns[nsid.name];
      }
      return ctx.custom_tags[name] || undefined;
    }

    let in_script = false;

    function walk (r, yieldfn) {
      switch (r.type) {
        case _doctype: {
          html += '<!DOCTYPE html>';
          break;
        }
        case _tag: {
          let n = r.data.name;
          let t = custom_tag(n, r.data.possible_id);
          if (t) {
            state.push({ props: eval_object(r.data.attributes) });
            children(t, function () {
              children(r, yieldfn);
            });
            state.pop();
            break;
          }
          if (r.data.attributes.root) {
            if (!mount) html += `<script>${runtime()}${end_script()}`;
            if (ast.data.styles) html += `<style>${ast.data.styles}</style>`;
          }
          if (r.data.attributes.innerHTML) {
            let a = r.data.attributes;
            html += `<${n}${assemble_attributes(a)}>${evaluate(a.innerHTML)}</${n}>`;
          } else {
            html += `<${n}${assemble_attributes(r.data.attributes)}>`;
            if (void_tags.indexOf(n) === -1) {
              if (n === 'script') in_script = true;
              children(r, yieldfn);
              in_script = false;
              html += `</${n}>`;
            }
          }
          break;
        }
        case _custom: {
          add_custom_tag(r.data, r);
          break;
        }
        case _textnode: {
          if (in_script) {
            html += evaluate(r.data);
          } else {
            html += escapeHTML(evaluate(r.data));
          }
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
          push_ctx(r.data.namespace);
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

    return mount ? {
      html: html,
      runtime: runtime()
    } : html;
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
  var $$states = {};
  var $$rendered = {};
  var $$is_syncing = false;
  var $$is_svg = false;
  var $$nodes = [];

  function $$a (node, attrs, isSvg) {
    var ns = 'http://www.w3.org/2000/xlink';
    if (typeof attrs === 'string') {
      node.nodeValue = attrs;
      return;
    }
    Object.keys(attrs).forEach(function (p) {
      var a = attrs[p];
      var v = a && a.constructor === Array ? a.join(' ')
        : typeof a === 'object' ? Object.keys(a).filter(function (k) {
          return a[k];
        }).join(' ') : a;
      if (!$$is_svg && p in node) {
        node[p] = v;
      } else if (v === false || v == null) {
        if ($$is_svg && (p === 'href' || p === 'xlink:href')) {
          node.removeAttributeNS(ns, 'href');
        } else {
          node.removeAttribute(p);
        }
      } else {
        if ($$is_svg && (p === 'href' || p === 'xlink:href')) {
          node.setAttributeNS(ns, 'href', v);
        } else {
          node.setAttribute(p, v);
        }
      }
    });
    return node;
  }

  function $$addEventListeners (node, events) {
    var keys = Object.keys(events);
    if (!node.__eventRefs) node.__eventRefs = {};
    else {
      for (var e in node.__eventRefs) {
        node.removeEventListener(e, node.__eventRefs[e]);
      }
    }
    keys.forEach(function (event) {
      node.addEventListener(event, events[event]);
      node.__eventRefs[event] = events[event];
    });
  }

  function $$each (list, fn) {
    if (Array.isArray(list)) {
      for (var i = 0; i < list.length; i++) {
        fn(list[i], i, i);
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

  function $$create (type) {
    var node, xmlns = 'http://www.w3.org/2000/svg';
    if (type === 'text') {
      node = document.createTextNode('');
    } else if ($$is_svg) {
      node = document.createElementNS(xmlns, type);
    } else {
      node = document.createElement(type);
    }
    return node;
  }

  function $$clean () {
    var node = $$nodes.pop();
    var parent = node.ref;
    var num = node.processed;
    while (parent.childNodes[num]) {
      parent.removeChild(parent.childNodes[num]);
    }
  }

  function $$parent () {
    var node = $$nodes[$$nodes.length - 1];
    var child = node.ref.childNodes[node.processed++];
    return { parent: node.ref, child: child };
  }

  function $$e (id, type, attrs, events, children) {
    var node, _ = $$parent();
    var child = _.child, parent = _.parent;
    if (type === 'svg') $$is_svg = true;
    if (child && child.__id === id) {
      node = child;
    } else {
      node = $$create(type);
      node.__id = id;
      if (child) {
        parent.replaceChild(node, child);
      } else {
        parent.appendChild(node);
      }
    }
    $$a(node, attrs);
    $$addEventListeners(node, events);
    if (children) {
      $$nodes.push({ ref: node, processed: 0 });
      children();
      $$clean();
    }
    if (type === 'svg') {
      $$is_svg = false;
    }
  }

  function $$set_event (events, event, fn) {
    if (events[event]) {
      events[event].push(fn);
    } else {
      events[event] = [fn];
    }
  }

  function $$emit_event (event, data) {
    var callbacks = this.events[event];
    if (callbacks) {
      callbacks.forEach(function (fn) {
        fn(data);
      })
    }
  };

  function $$c (Component, body, initial_state) {
    return function (id, props, events, yield_fn) {
      var state = $$states[id];
      var isNew = false;
      if (!state) {
        state = Object.assign(Component ? new Component() : {}, initial_state(props));
        state.events = {};
        state.emit = $$emit_event.bind(state);
        isNew = true;
      }
      body(state, props, yield_fn);
      if (isNew) {
        if (state.mount) state.mount();
        if (state.events) {
          for (var event in events) {
            $$set_event(state.events, event, events[event]);
          }
        }
      }
      $$rendered[id] = true;
      $$states[id] = state;
    }
  }

  function $$clean_states () {
    for (var id in $$states) {
      if (!$$rendered[id]) {
        if ($$states[id].unmount) {
          $$states[id].unmount();
        }
        delete $$states[id];
      }
    }
    $$rendered = {};
  }
`;

  Adom.prototype.generate_runtime = function (ast) {
    let output = [];
    let indents = 2;
    let in_tag = false;
    let tag_id = 0;
    let loop_depth = 0;
    let tag_ctx = {};
    let uuid = this.uid;
    let f_id = 0;
    let file_stack = [];
    let files = [];
    let tag_state = {};

    function bundle (file, filepath) {
      const path = require('path');
      const fs = require('fs');

      let _id = 0;
      let idmap = {};

      function getProperties (filepath) {
        let del = filepath.indexOf('\\') > -1 ? '\\' : '/';
        let parts = filepath.split(del);
        let file = parts.pop();
        let parent = parts.join(del);

        if (file.indexOf('.') === -1) {
          if (fs.existsSync(path.resolve(parent, `${file}.js`))) {
            file += '.js';
          } else {
            parent = path.resolve(parent, file);
            file = 'index.js';
          }
        }

        return { parent, file: path.resolve(parent, file) };
      }

      function isalnum (c) {
        return ((c.toUpperCase() != c.toLowerCase()) || (c >= '0' && c <= '9'));
      }

      function getRequires (file, parent) {
        let requires = [];
        let inRequire = false;

        for (let i = 0; i < file.length; i++) {
          if (file[i] === '/' && file[i+1] === '/') {
            while (true) {
              if (i >= file.length) break;
              if (file[i] === '\n' || file[i] === '\r') break;
              i++;
            }
          } else if (file[i] === '/' && file[i+1] === '*') {
            while (true) {
              if (i >= file.length) break;
              if (file[i] === '*' && file[i+1] === '/') {
                i++;
                break;
              }
              i++;
            }
          } else if (file[i] === '"' || file[i] === '\'' || file[i] === '`') {
            let del = file[i++];
            let str = '';
            let begin = i;
            while (true) {
              if (i >= file.length) break;
              if (file[i] === del) break;
              if (file[i] === '\\') i++;
              str += file[i++];
            }
            let end = i;
            if (inRequire === true) {
              let p = path.resolve(parent, str);
              let props = getProperties(p);
              requires.push({
                filepath: props.file,
                begin: begin,
                end: end,
                parent: props.parent,
                id: `f${idmap[p] ? idmap[p] : (idmap[p] = _id++)}`
              });
              inRequire = false;
            }
          } else if (file[i] === 'r' && file[i+1] === 'e' && file[i+2] === 'q' &&
            file[i+3] === 'u' && file[i+4] === 'i' && file[i+5] === 'r' &&
            file[i+6] === 'e') {
            if (i === 0 || (file[i-1] !== '_' && !isalnum(file[i-1]))) {
              i+=7;
              if (file[i] === ' ' || file[i] === '\t') {
                i++;
                while (true) {
                  if (i >= file.length) break;
                  if (file[i] !== ' ' && file[i] !== '\t') break;
                  i++;
                }
              }
              if (file[i] === '(') {
                inRequire = true;
              } else {
                i--;
              }
            }
          }
        }
        return requires;
      }

      function makeModifications (file, requires) {
        let out = '';
        let prev = 0;
        for (let i = 0; i < requires.length; i++) {
          let r = requires[i];
          out += file.slice(prev, r.begin) + r.id;
          if (i === requires.length - 1) {
            out += file.slice(r.end);
          }
          prev = r.end;
        }
        return !out ? file : out;
      }

      function openFile (filepath) {
        try {
          let file = fs.readFileSync(filepath, 'utf8');
          return file;
        } catch (e) {
          throw new Error(e);
        }
      }

      class Node {
        constructor(id, text) {
          this.id = id;
          this.text = text;
          this.visited = false;
          this.edges = [];
        }
        addEdge(node) {
          this.edges.push(node);
        }
      }

      function setUp () {
        let properties = getProperties(filepath);
        let initialId = `f${_id++}`;
        let requires = getRequires(file, properties.parent);
        let root = new Node(initialId, makeModifications(file, requires));
        return {
          requires: requires,
          node: root 
        };
      }

      let stack = [setUp()];
      let graph = stack[0].node;
      let keymap = {[graph.id]: graph};

      function renderGraph (root) {
        let rendered = '';
        let stack = [root];
        while (stack.length) {
          let node = stack[stack.length-1];
          if (node.edges.filter(edge => !edge.visited).length === 0) {
            stack.pop();
            if (node == root) {
              rendered += node.text;
            } else {
              rendered += [
                `__files.${node.id} = (function() {`,
                `  var module = { exports: {} };`,
                `  var exports = module.exports;`,
                node.text,
                `  return module.exports;`,
                `})();\n`
              ].join('\n');
            }
          } else {
            node.edges.forEach(edge => {
              edge.visited = true;
              stack.push(edge);
            });
          }
        }
        return rendered;
      }

      while (stack.length) {
        let info = stack.shift();
        let requires = info.requires;
        let pnode = info.node;
        for (let i = 0; i < requires.length; i++) {
          let r = requires[i];
          let text = openFile(r.filepath);
          let rq = getRequires(text, r.parent);
          let m = makeModifications(text, rq);
          let node;
          if (!keymap[r.id]) {
            node = new Node(r.id, m);
            keymap[r.id] = node;
            stack.push({
              requires: rq,
              node: node
            });
          } else {
            node = keymap[r.id];
          }
          pnode.addEdge(node);
        }
      }

      return renderGraph(graph);
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
        case 'unop': {
          let v = print_expression(expr.data);
          return `(${expr.op}${v})`;
        } break;
        case 'binop': {
          let v1 = print_expression(expr.data[0]);
          let v2 = print_expression(expr.data[1]);
          return `(${v1} ${expr.op} ${v2})`;
        } break;
        case 'parenthetical': {
          return `(${print_expression(expr.data)})`;
        } break;
        case 'map':
        case 'filter': {
          let l = expr.data[1];
          return `${print_expression(expr.data[0])}.${expr.type}(function (${l.args.join(',')}) { return ${print_expression(l.expr)}; })`
        } break;
      }
    }

    function fmt() {
      return '  '.repeat(indents);
    }

    function update (state, reverse) {
      if (!state) return '{}';
      let p1 = '$.', p2 = '';
      if (reverse) {
        p1 = '';
        p2 = '$.';
      }
      return state.map(k => `${p1}${k} = ${p2}${k};`).join('');
    }

    function event (e) {
      let update = !in_tag ? '' : (e.handler.indexOf('this') === -1 ? '$u0();' : (e.sync ? '': '$u1();'));
      let sync = e.sync ? '$sync();' : '';
      return `"${e.type}": function ($e) { (function () { ${e.handler}; ${update} ${sync} }).call(${in_tag ? '$' : ''}); }`;
    }

    function event_object (events, state) {
      if (events.length) return `{${events.map(e => event(e, state)).join(',')}}`;
      else return '{}';
    }

    function attribute_object(obj) {
      return `{${Object.keys(obj).map((k, i) => `"${k}": ${print_expression(obj[k])}`).join(', ')}}`
    }

    function render_line (str, indent = 0) {
      if (indent === -1) {
        indents--;
        output.push(`${fmt()}${str}`);
      } else {
        output.push(`${fmt()}${str}`);
        indents += indent; 
      }
    }

    function render_component (name, t) {
      let sk = Object.keys(t.state);
      let cl = `typeof ${name} === "function" ? ${name} : null`;
      let s = state_initializer(t.state);
      render_line(`var $${name} = $$c(${cl}, function ($, props, $$yield) { (function (${sk.join(',')}) {`, 1);
      render_line(`function $u0 () { ${update(sk)} }`);
      render_line(`function $u1 () { ${update(sk, true)} }`);
      in_tag = true;
      t.node.children.forEach(render_tag);
      in_tag = false;
      render_line(`})(${sk.map(k => `$.${k}`).join(',')}); }, ${s});`, -1);
    }

    function render_export (name) {
      render_line(`$components.${name} = $${name};`);
    }

    function render_import (data, exp) {
      if (data.ns) {
        render_line(`var ${data.ns} = $${data.name}.exports; var $${data.ns} = $${data.name}.components;`);
      } else {
        for (e of exp) {
          render_line(`var $${e} = $${data.name}.components.${e};`);
        }
      }
    }

    function state_initializer (s) {
      let out = 'function (props) { var $s = {}; ';
      for (k in s) {
        out += `var ${k} = ${print_expression(s[k])}; `;
        out += `$s.${k} = ${k}; `;
      }
      out += 'return $s; }';
      return out;
    }

    function tid () {
      return `a-${tag_id++}`;
    }

    function generate_id () {
      if (loop_depth) {
        let indexes = [`'${tid()}'`];
        for (let i = 0; i < loop_depth; i++) {
          indexes.push(`__index${i}`);
        }
        return indexes.join(" + '-' + ");
      } else {
        return `'${tid()}'`;
      }
    }

    function render_tag (el) {
      if (el.type === _tag) {
        let events = event_object(el.data.events);
        let attr = attribute_object(el.data.attributes);
        let p = el.data.possible_id;
        let pn = p ? `${p.namespace}.${p.name}` : undefined;
        let id = generate_id();

        if (tag_ctx[el.data.name] || tag_ctx[pn]) {
          let n = pn || el.data.name;
          render_line(`$${n}(${id}, ${attr}, ${events}, function () {`, 1);
        } else {
          render_line(`$$e(${id}, "${el.data.name}", ${attr}, ${events}, function () {`, 1);
        }
        el.children.forEach(render_tag);
        render_line(`});`, -1);
      } else if (el.type === _textnode) {
        render_line(`$$e('${tid()}', "text", ${print_expression(el.data)}, {});`);
      } else if (el.type === _yield) {
        render_line(`$$yield();`);
      } else if (el.type === _each) {
        loop_depth++;
        let it = el.data.iterators.concat([`__index${loop_depth-1}`]);
        render_line(`$$each(${print_expression(el.data.list)}, function (${it.filter(i => i).join(',')}) {`, 1);
        el.children.forEach(render_tag);
        loop_depth--;
        render_line(`});`, -1);
      } else if (el.type === _if) {
        render_line(`if (${print_expression(el.data)}) {`, 1);
        el.children[0].children.forEach(render_tag);
        if (el.children[1]) {
          render_line('} else {', -1);
          indents++;
          el.children[1].children.forEach(render_tag);
        }
        render_line(`}`, -1);
      } else {
        el.children.forEach(render_tag);
      }
    }

    function walk (node) {
      if (node.type === _file) {
        file_stack.push({
          imports: [],
          exports: [],
          tags: {},
          js: node.data.runtime,
          filepath: node.data.file
        });
        node.children.forEach(walk);
        let n = `f${f_id++}`;
        files[n] = file_stack.pop();
        if (file_stack.length) {
          let f = file_stack[file_stack.length - 1];
          f.imports.push({ name: n, ns: node.data.namespace });
        }
      } else if (node.type === _export) {
        let f = file_stack[file_stack.length - 1];
        f.exports.push(node.data.name);
        node.children.forEach(walk);
      } else if (node.type === _custom) {
        let f = file_stack[file_stack.length - 1];
        let t = { node };
        f.tags[node.data.name] = t;
        tag_state = {};
        node.children.forEach(walk);
        t.state = tag_state;
        tag_state = {};
      } else if (node.type === _set) {
        tag_state[node.data.lhs.data] = node.data.rhs;
      } else if (node.type === _tag) {
        if (node.data.attributes.root) {
          file_stack[file_stack.length - 1].sync = node.children;
        } else {
          node.children.forEach(walk);
        }
      }
    }

    function render_files (files) {
      for (name in files) {
        let file = files[name];
        tag_ctx = {...file.tags};
        for (i of file.imports) {
          f = files[i.name];
          for (t of f.exports) {
            if (i.ns) {
              tag_ctx[`${i.ns}.${t}`] = f.tags[t];
            } else {
              tag_ctx[t] = f.tags[t];
            }
          }
        }
        render_line(`var $${name} = (function () {`, 1);
        render_line('var $exports = {};');
        render_line('var $components = {};');
        render_line('var __files = {};');
        render_line('function require(id) {', 1);
        render_line('return __files[id]');
        render_line('}', -1);
        for (i of file.imports) {
          render_import(i, files[i.name].exports);
        }
        if (file.js) {
          bundle(file.js, file.filepath).split('\n').forEach(line => render_line(line));
        }
        for (t in file.tags) {
          render_component(t, file.tags[t]);
        }
        for (e of file.exports) {
          render_export(e);
        }
        if (file.sync) {
          render_line('$sync = function () {', 1);
          render_line('if ($$is_syncing === false) {', 1);
          render_line('$$is_syncing = true;');
          render_line(`$$nodes.push({ ref: window['adom-root-${uuid}'], processed: 0 });`);
          for (c of file.sync) {
            render_tag(c);
          }
          render_line('$$clean();');
          render_line('$$clean_states();');
          render_line('$$is_syncing = false;');
          render_line('}', -1);
          render_line('};', -1);
        }
        render_line('return { exports: $exports, components: $components }');
        render_line('})();', -1);
      }
    }

    walk(ast);
    render_files(files);

    return output.join('\n');
  };

  Adom.prototype.getPath = function (p, dir) {
    try {
      let path = require("path");
      return path.resolve(dir || this.dirname, p);
    } catch (e) {
      return p;
    }
  };

  Adom.prototype.openFile = function(p, dir) {
    let fs;

    try {
      fs = require("fs");
    } catch (e) {
      return { name: '', text: '' }
    }

    let f = this.getPath(p, dir);
    let t = fs.readFileSync(f).toString();

    this.files[f] = t;

    return {
      name: f,
      text: t
    };
  };

  Adom.prototype.finalize = function (ast) {
    ast.data.runtime = this.generate_runtime(ast);
    let pending = [];
    let stack = [ast];
    while (stack.length) {
      let n = stack.shift();
      if (n.type === _set) {
        let dst = n.data.rhs;
        if (dst.type === 'file') {
          pending.push({ file: dst.name, dir: dst.dir, node: n, filter: dst.filter });
        }
      }
      n.children.forEach(child => {
        stack.push(child);
      });
    }
    pending.forEach(p => {
      let file = this.openFile(p.file, p.dir);
      let f = p.filter; 
      if (f) {
        if (this.filters[f.name]) {
          try {
            file.text = this.filters[f.name](file.text);
          } catch (e) {
            throw_adom_error({ msg: f.name + ' filter error: ' + e.toString(), pos: f.pos, file: f.file });
          }
        } else {
          throw_adom_error({ msg: 'unknown filter: ' + f.name, pos: f.pos, file: f.file });
        }
      }
      p.node.data.rhs.type = 'string'
      p.node.data.rhs.data = [{ type: 'chunk', data: file.text }];
    });
  };

  Adom.prototype.render = function(file, input_state) {
    let html;
    try {
      let cacheKey = this.getPath(file);
      let html;

      if (this.cache && this.ast_cache[cacheKey]) {
        html = this.execute(this.ast_cache[cacheKey], input_state || {});
      } else {
        let f = this.openFile(file);
        let tokens = this.tokenize(f.text, f.name);
        let ast = this.parse(tokens);
        this.finalize(ast);
        html = this.execute(ast, input_state || {});
        if (this.cache) {
          this.ast_cache[cacheKey] = ast;
        }
      }

      return html;
    } catch (e) {
      if (e.origin === 'adom') {
        html = `<pre>${this.print_error(e)}</pre>`;
      } else {
        console.log(e);
        html = `<pre>${e.toString()}</pre>`;
      }
      return html;
    }
  };

  Adom.prototype.mount = function (sel, str) {
    try {
      let tokens = this.tokenize(str, 'main');
      let ast = this.parse(tokens);
      ast.data.runtime = this.generate_runtime(ast);
      let out = this.execute(ast, {}, true);
      document.querySelector(sel).innerHTML = out.html;
      window.eval(out.runtime);
    } catch (e) {
      let html
      if (e.origin === 'adom') {
        html = `<pre>${this.print_error(e, str)}</pre>`;
      } else {
        html = `<pre>${e.toString()}</pre>`;
      }
      document.querySelector(sel).innerHTML = html;
    }
  }

  return Adom;
})();

if (typeof module !== 'undefined') {
  module.exports = Adom
} else {
  window.Adom = Adom
}
