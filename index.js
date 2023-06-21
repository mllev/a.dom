/*
Copyright 2023 Matthew Levenstein

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

var Adom = (function () {
  function Adom (config = {}) {
    this.cache = config.cache || false;
    this.minify = config.minify || false;
    this.dirname = config.root || ".";
    this.ast_cache = {};
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

  const valid_tags = [
    'a',
    'abbr',
    'acronym',
    'address',
    'applet',
    'area',
    'article',
    'aside',
    'audio',
    'b',
    'base',
    'basefont',
    'bdi',
    'bdo',
    'bgsound',
    'big',
    'blink',
    'blockquote',
    'body',
    'br',
    'button',
    'canvas',
    'caption',
    'center',
    'cite',
    'code',
    'col',
    'colgroup',
    'command',
    'content',
    'data',
    'datalist',
    'dd',
    'del',
    'details',
    'dfn',
    'dialog',
    'dir',
    'div',
    'dl',
    'dt',
    'element',
    'em',
    'embed',
    'fieldset',
    'figcaption',
    'figure',
    'font',
    'footer',
    'form',
    'frame',
    'frameset',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'head',
    'header',
    'hgroup',
    'hr',
    'html',
    'i',
    'iframe',
    'image',
    'img',
    'input',
    'ins',
    'isindex',
    'kbd',
    'keygen',
    'label',
    'legend',
    'li',
    'link',
    'listing',
    'main',
    'map',
    'mark',
    'marquee',
    'math',
    'menu',
    'menuitem',
    'meta',
    'meter',
    'multicol',
    'nav',
    'nextid',
    'nobr',
    'noembed',
    'noframes',
    'noscript',
    'object',
    'ol',
    'optgroup',
    'option',
    'output',
    'p',
    'param',
    'picture',
    'plaintext',
    'pre',
    'progress',
    'q',
    'rb',
    'rbc',
    'rp',
    'rt',
    'rtc',
    'ruby',
    's',
    'samp',
    'script',
    'search',
    'section',
    'select',
    'shadow',
    'slot',
    'small',
    'source',
    'spacer',
    'span',
    'strike',
    'strong',
    'style',
    'sub',
    'summary',
    'sup',
    'table',
    'tbody',
    'td',
    'template',
    'textarea',
    'tfoot',
    'th',
    'thead',
    'time',
    'title',
    'tr',
    'track',
    'tt',
    'u',
    'ul',
    'var',
    'video',
    'wbr',
    'xmp',
    // svg tags
    'svg',
    'altGlyph',
    'altGlyphDef',
    'altGlyphItem',
    'animate',
    'animateColor',
    'animateMotion',
    'animateTransform',
    "circle",
    "clipPath",
    "color-profile",
    "cursor",
    "defs",
    "desc",
    "ellipse",
    "feBlend",
    "feColorMatrix",
    "feComponentTransfer",
    "feComposite",
    "feConvolveMatrix",
    "feDiffuseLighting",
    "feDisplacementMap",
    "feDistantLight",
    "feFlood",
    "feFuncA",
    "feFuncB",
    "feFuncG",
    "feFuncR",
    "feGaussianBlur",
    "feImage",
    "feMerge",
    "feMergeNode",
    "feMorphology",
    "feOffset",
    "fePointLight",
    "feSpecularLighting",
    "feSpotLight",
    "feTile",
    "feTurbulence",
    "filter",
    "font",
    "font-face",
    "font-face-format",
    "font-face-name",
    "font-face-src",
    "font-face-uri",
    "foreignObject",
    "g",
    "glyph",
    "glyphRef",
    "hkern",
    "image",
    "line",
    "linearGradient",
    "marker",
    "mask",
    "metadata",
    "missing-glyph",
    "mpath",
    "path",
    "pattern",
    "polygon",
    "polyline",
    "radialGradient",
    "rect",
    "script",
    "set",
    "stop",
    "style",
    "svg",
    "switch",
    "symbol",
    "text",
    "textPath",
    "title",
    "tref",
    "tspan",
    "use",
    "view",
    "vkern",
    // end svg tags
  ]


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
      "nosync"
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
      } else if (c === '`') {
        let i = cursor + 1;
        let text = '';
        while (true) {
          if (i > end_pos) {
            throw_adom_error({ msg: "unterminated string", pos: offs + cursor, file: file });
          }
          if (prog[i] === '`') {
            i++;
            break;
          }
          if (prog[i] === "\\" && prog[i + 1] === '`') {
            text += prog[i + 1];
            i += 2;
          }
          text += prog[i++];
        }
        let lines = text.split(/\r?\n/);
        const start = lines[0];
        const end = lines[lines.length - 1];
        if (start === '') lines.shift();
        if (!/\S/.test(end)) {
          const len = end.length;
          lines = lines.map((line) => {
            return line.slice(len);
          });
        }
        text = lines.join('\n');
        tokens.push({ type: 'string', pos: offs + cursor, file: file });
        tokens.push({ type: 'chunk', data: text, pos: offs + cursor, file: file })
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
      } else if (c === "-" && prog[cursor + 1] === "-" && prog[cursor + 2] === "-") {
        let i = cursor + 3;
        let found = false;
        while (i <= (end_pos - 2)) {
          if (
            prog[i] === "-" &&
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
          throw_adom_error({ msg: "expected closing ---", pos: offs + cursor, file: file });
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
    let in_tag = false;
    let ast = new ASTNode('file', { file: tok.file });
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
      let del = path.indexOf('\\') > -1 ? '\\' : '/'
      let dir = path.split(del);
      dir.pop();
      return dir.join(del);
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
          data: [expr, parse_expr1(prec + 1)]
        };
      }

      if (min_prec < 1 && accept('?')) {
        expr = {
          type: 'ternary',
          data: [expr],
          pos: expr.pos,
          file: expr.file
        };
        expr.data.push(parse_expr1(0));
        expect(':');
        expr.data.push(parse_expr1(0));
      }

      return expr;
    }

    const pipeables = {
      'repeat': 1,
      'length': 0,
      'map': 1,
      'filter': 1,
      'toupper': 0,
      'tolower': 0,
      'split': 1,
      'includes': 1,
      'indexof': 1,
      'reverse': 0,
      'tojson': 0,
      'replace': 2,
      'replaceall': 2,
      'tostring': 0,
      'join': 1,
      'keys': 0,
      'values': 0
    };

    function parse_expr (min_prec) {
      if (min_prec == null) min_prec = 0;
      let expr = parse_expr1(min_prec);
      while (true) {
        if (accept('|')) {
          const func = tok.data;
          const { pos, file } = tok;
          expect('ident');
          let count = pipeables[func];
          if (count == null) {
            throw_adom_error({
              msg: `Cannot pipe into: ${func}`,
              pos,
              file
            });
          }
          const args = [func, expr];
          while (count > 0) {
            args.push(parse_expr1(0));
            count--;
          }
          expr = {
            type: 'pipe',
            data: args
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
          arr.push(parse_expr());
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
        if (accept("ident")) {
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
      let { pos, file } = tok;
      expect("ident");
      let classlist = parse_class_list();
      let attr_data = parse_attributes();
      let events = attr_data[1];
      let attr = attr_data[0];
      if (classlist.data.length > 0) {
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
      let node = ast_node('tag', {
        name: name,
        attributes: attr,
        events: events,
        pos,
        file
      });
      let current = parent;
      parent = node;
      if (accept("[")) {
        parse_tag_list();
        expect("]");
      } else if (peek("string")) {
        let str = parse_string();
        ast_node('textnode', str);
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
      let node = ast_node('if', condition);
      parent = node;
      let pass = ast_node('block');
      parent = pass;
      if (accept("[")) {
        parse_tag_list();
        expect("]");
      } else {
        parse_tag();
      }
      if (accept("else")) {
        parent = node;
        let fail = ast_node('block');
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
      if (accept("if")) {
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
        let node = ast_node('each', {
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
        ast_node('textnode', str);
        parse_tag_list();
      } else if (accept("yield")) {
        ast_node('yield');
        parse_tag_list();
      } else if (in_tag && (peek('var') || peek('const') || peek('let'))) {
        parse_assignment();
        parse_tag_list();
      } else if (in_tag && peek('js_context')) {
        parent.js = tok.data;
        ast_node('js', tok.data);
        next();
        parse_tag_list();
      }
    }

    function parse_custom_tag() {
      expect("tag");
      let tag = tok.data;
      let pos = tok.pos, file = tok.file;
      expect("ident");
      expect("[");
      let node = ast_node('custom', { name: tag, pos: pos, file: file });
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

    const parse_rhs = () => {
      let val;
      if (accept("file")) {
        let path = parse_strict_string();
        let dir = get_dir(tok.file);
        let file = this.openFile(path, dir);
        val = {
          pos: tok.pos,
          file: tok.file,
          type: 'string',
          data: [{ type: 'chunk', data: file.text }]
        };
      } else {
        val = parse_expr();
      }
      return val;
    }

    function parse_assignment () {
      next();
      let dst = { data: tok.data, pos: tok.pos, file: tok.file };
      next();
      accept("=");
      let val = parse_rhs();
      ast_node('set', {
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
          let node = ast_node('file', _ast.data);
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
          ast_node('export', {
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
          ast_node('js', tok.data);
          js_found = true;
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

  Adom.prototype.execute = function(ast, initial_state) {
    let html = "";
    let state = [initial_state];
    let custom_tags = [];
    let file_ctx = [];

    function push_ctx () {
      file_ctx.push({
        exports: [],
        custom_tags: {}
      });
    }

    function pop_ctx () {
      let ctx = file_ctx.pop();
      if (!file_ctx.length) return;
      ctx.exports.forEach(e => {
        if (ctx.custom_tags[e.name]) {
          add_custom_tag(e, ctx.custom_tags[e.name].tag, ctx.custom_tags);
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

    function add_custom_tag (e, tag, file_tags) {
      let ctx = file_ctx[file_ctx.length - 1];
      if (ctx.custom_tags[e.name]) {
        throw_adom_error({ msg: 'duplicate tag: ' + e.name, pos: e.pos, file: e.file });
      }
      ctx.custom_tags[e.name] = { tag, file_tags };
    }

    function escapeHTML (txt) {
      return txt.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function assemble_attributes(attr) {
      return Object.keys(attr).map(function (k) {
        if (k === 'innerHTML') return '';
        let v = evaluate(attr[k]);
        if (v === false || v == null) return '';
        if (typeof v === 'string' && v.indexOf('"') > -1) v = v.replace(/"/g, '&quot;');
        if (k.indexOf('bind:') !== -1) k = k.replace('bind:', '');
        if (Array.isArray(v)) v = v.map((c) => {
          if (typeof c === 'object') {
            return Object.keys(c).filter((k) => c[k]).join(' ');
          }
          return c;
        }).join(' ');
        if (typeof v === 'object') v = Object.keys(v).filter((k) => v[k]).join(' ');
        return ` ${k}="${v}"`
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
        case 'pipe': {
          const op = expr.data[0];
          switch (op) {
            case 'repeat': {
              const arr = [];
              const count = evaluate(expr.data[2]);
              for (let i = 0; i < count; i++) {
                arr.push(evaluate(expr.data[1]));
              }
              return arr;
            } break;
            case 'length': {
              const data = evaluate(expr.data[1]);
              return data.length;
            } break;
            case 'filter':
            case 'map': {
              const t = expr.data[0]; // map or filter
              const s = {};
              let l = evaluate(expr.data[1]);
              const r = expr.data[2];
              state.push(s);
              l = l[t]((_1, _2) => {
                s._1 = _1;
                s._2 = _2;
                return evaluate(r);
              });
              state.pop();
              return l;
            } break;
            case 'toupper': {
              const e = evaluate(expr.data[1]);
              return e.toUpperCase();
            } break;
            case 'tolower': {
              const e = evaluate(expr.data[1]);
              return e.toLowerCase();
              return;
            } break;
            case 'split': {
              const e = evaluate(expr.data[1]);
              const del = evaluate(expr.data[2]);
              return e.split(del);
            } break;
            case 'includes': {
              const e = evaluate(expr.data[1]);
              const i = evaluate(expr.data[2]);
              return e.indexOf(i) > -1;
            } break;
            case 'indexof': {
              const e = evaluate(expr.data[1]);
              const i = evaluate(expr.data[2]);
              return e.indexOf(i);
            } break;
            case 'reverse': {
              const e = evaluate(expr.data[1]);
              if (Array.isArray(e)) {
                return e.reverse();
              } else {
                return e.split('').reverse().join('')
              }
            } break;
            case 'tojson': {
              const e = evaluate(expr.data[1]);
              return JSON.parse(e);
            } break;
            case 'replace': {
              const e = evaluate(expr.data[1]);
              const r = evaluate(expr.data[2]);
              const n = evaluate(expr.data[3]);
              return e.replace(r, n);
            } break;
            case 'replaceall': {
              const e = evaluate(expr.data[1]);
              const r = evaluate(expr.data[2]);
              const n = evaluate(expr.data[3]);
              return e.replaceAll(r, n);
            } break;
            case 'tostring': {
              const e = evaluate(expr.data[1]);
              if (typeof e === 'object') {
                return JSON.stringify(e);
              } else {
                return e.toString();
              }
            } break;
            case 'join': {
              const e = evaluate(expr.data[1]);
              const del = evaluate(expr.data[2]);
              return e.join(del);
            } break;
            case 'keys': {
              const e = evaluate(expr.data[1]);
              return Object.keys(e);
            } break;
            case 'values': {
              const e = evaluate(expr.data[1]);
              return Object.values(e);
            } break;
            default:
              break; 
          }
          break;
        }
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

    function custom_tag (name) {
      const ctx = file_ctx[file_ctx.length - 1];
      const local_tags = custom_tags.length > 0 ? custom_tags[custom_tags.length - 1] : {};
      return local_tags[name] || ctx.custom_tags[name] || undefined;
    }

    let in_script = false;

    function walk (r, yieldfn) {
      switch (r.type) {
        case 'tag': {
          let n = r.data.name;
          let t = custom_tag(n);
          if (t) {
            custom_tags.push(t.file_tags);
            state.push({ props: eval_object(r.data.attributes) });
            children(t.tag, function () {
              children(r, yieldfn);
            });
            state.pop();
            custom_tags.pop();
            break;
          }
          if (n === 'html') {
            html += '<!DOCTYPE html>';
          }
          if (r.data.attributes.innerHTML) {
            let a = r.data.attributes;
            html += `<${n}${assemble_attributes(a)}>${evaluate(a.innerHTML)}</${n}>`;
          } else {
            html += `<${n}${assemble_attributes(r.data.attributes)}>`;
            if (valid_tags.indexOf(n) === -1) {
              throw_adom_error({ msg: 'Invalid tag: ' + n, pos: r.data.pos, file: r.data.file });
            }
            if (void_tags.indexOf(n) === -1) {
              if (n === 'script') in_script = true;
              children(r, yieldfn);
              in_script = false;
              if (n === 'head') {
                html += `<script>${ast.data.runtime}${end_script()}`;
              }
              html += `</${n}>`;
            }
          }
          break;
        }
        case 'custom': {
          add_custom_tag(r.data, r, file_ctx[file_ctx.length - 1].custom_tags);
          break;
        }
        case 'textnode': {
          if (in_script) {
            html += evaluate(r.data);
          } else {
            html += escapeHTML(evaluate(r.data));
          }
          break;
        }
        case 'set': {
          set_state(r.data.lhs, r.data.rhs);
          break;
        }
        case 'if': {
          let pass = r.children[0];
          let fail = r.children[1];
          if (evaluate(r.data)) {
            children(pass, yieldfn);
          } else if (fail) {
            children(fail, yieldfn);
          }
          break;
        }
        case 'each': {
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
        case 'yield': {
          if (yieldfn) yieldfn();
          break;
        }
        case 'export': {
          add_export(r.data);
          break;
        }
        case 'file': {
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
  var $$states = {};
  var $$rendered = {};
  var $$is_syncing = false;
  var $$is_svg = false;
  var $$nodes = [];
  var $$_id = 0;

  function $$id () {
    return 'id-' + $$_id++;
  }

  function $$a (node, attrs, isSvg) {
    var old = node.__old;
    var ns = 'http://www.w3.org/2000/xlink';
    if (typeof attrs === 'string') {
      if (node.nodeValue !== attrs) {
        node.nodeValue = attrs;
      }
      return;
    }
    Object.keys(attrs).forEach(function (p) {
      var a = attrs[p];
      var v = a && a.constructor === Array ? a.map(function (v) {
        return typeof v === 'object' ? Object.keys(v).filter(function (k) {
          return v[k];
        }).join(' ') : v
      }).join(' ')
        : typeof a === 'object' ? Object.keys(a).filter(function (k) {
          return a[k];
        }).join(' ') : a;
      if (!$$is_svg && p in node) {
        if (old[p] !== v) {
          old[p] = v;
          node[p] = v;
        }
      } else if (v === false || v == null) {
        if ($$is_svg && (p === 'href' || p === 'xlink:href')) {
          node.removeAttributeNS(ns, 'href');
        } else {
          node.removeAttribute(p);
        }
      } else {
        if ($$is_svg && (p === 'href' || p === 'xlink:href')) {
          if (old[p] !== v) {
            node.setAttributeNS(ns, 'href', v);
            old[p] = v;
          }
        } else if (old[p] !== v) {
          node.setAttribute(p, v);
          old[p] = v;
        }
      }
    });
    return;
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

  function $$e (type, attrs, events, children) {
    var id = $$id();
    var node, _ = $$parent();
    var child = _.child, parent = _.parent;
    var tag = child && child.tagName ? child.tagName.toLowerCase() : null;
    if (type === 'svg') $$is_svg = true;
    if (child && child.__id === id) {
      node = child;
    } else if (child && !child.__id && tag === type) {
      node = child;
      node.__id = id;
      node.__old = {};
    } else {
      node = $$create(type);
      node.__id = id;
      node.__old = {};
      if (child) {
        parent.replaceChild(node, child);
      } else {
        parent.appendChild(node);
      }
    }
    $$a(node, attrs);
    $$addEventListeners(node, events);
    if (children && !attrs.innerHTML) {
      $$nodes.push({ ref: node, processed: 0 });
      children();
      $$clean();
    }
    if (type === 'svg') {
      $$is_svg = false;
    }
  }

  function $$repeat(val, count) {
    var vals = [];
    for (var i = 0; i < count; i++) {
      if (typeof val === 'object') {
        vals.push(JSON.parse(JSON.stringify(val)));
      } else {
        vals.push(val);
      }
    }
    return vals;
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

  function $$c (init) {
    return function (props, events, yield_fn) {
      var id = $$id();
      var $state = $$states[id];
      var isNew = false;
      var newp = JSON.stringify(props);
      if (!$state) {
        $state = { events: {}, props: newp };
        $state.body = init(props, $$emit_event.bind($state), function (event, cb) {
          $$set_event($state.events, event, cb);
        });
        for (var event in events) {
          $$set_event($state.events, event, events[event]);
        }
        isNew = true;
      }
      const oldp = $state.props;
      $state.body(props, yield_fn);
      $state.props = newp;
      if (isNew) {
        $$emit_event.call($state, 'mount');
      } else if (newp !== oldp) {
        $$emit_event.call($state, 'change');
      }
      $$emit_event.call($state, 'render');
      $$rendered[id] = true;
      $$states[id] = $state;
    }
  }

  function $$clean_states () {
    for (var id in $$states) {
      if (!$$rendered[id]) {
        $$emit_event.call($$states[id], 'unmount');
        delete $$states[id];
      }
    }
    $$rendered = {};
  }
`;

  Adom.prototype.generateRuntime2 = function (ast, incoming_state) {
    const out = [''];
    const fileList = [];
    const fileIdMap = {};
    const yields = [];
    let write = false;
    let custom = false;
    let fileIdx;

    function emit(txt) {
      out[out.length - 1] += txt;
    }

    function createFileList(node) {
      if (node.type === 'file') {
        node.children.forEach((child) => {
          createFileList(child);
        });
        if (!fileIdMap[node.data.file]) {
          fileIdMap[node.data.file] = fileList.length;
          fileList.push({
            name: node.data.file,
            ast: node,
            exports: {},
            tags: {}
          });
        }
      }
    }

    function walk(node) {
      switch (node.type) {
        case 'if': {
          if (!custom && !write) {
            node.children.forEach(walk);
            break;
          }
          emit('if (');
          walk(node.data);
          emit(') {\n');
          node.children[0].children.forEach(walk);
          if (node.children[1]) {
            emit('} else {\n');
            node.children[1].children.forEach(walk);
          }
          emit('}\n');
        } break;
        case 'each': {
          if (!custom && !write) {
            node.children.forEach(walk);
            break;
          }
          emit('$$each(');
          walk(node.data.list);
          emit(', function (');
          emit(node.data.iterators.filter(i => i).join(','));
          emit(') {\n');
          node.children.forEach(walk);
          emit('});\n');
        } break;
        case 'yield':
          if (!custom) {
            yields[yields.length - 1]();
          } else {
            emit('$$yield();');
          }
          break;
        case 'export':
          emit('$components.');
          emit(node.data.name);
          emit(' = $');
          emit(node.data.name);
          emit(';\n');
          fileList[fileIdx].exports[node.data.name] = true;
          break;
        case 'js':
          emit(node.data);
          break;
        case 'file':
          const id = fileIdMap[node.data.file];
          const ex = fileList[id].exports;
          for (let e in ex) {
            emit('var $');
            emit(e);
            emit(' = $f');
            emit(id);
            emit('.components.');
            emit(e);
            emit(';\n');
            fileList[fileIdx].tags[e] = fileList[id].tags[e];
          }
          break;
        case 'custom': {
          let written = false;
          emit('var $');
          emit(node.data.name);
          emit(' = $$c(function (props, $emit, $on) {\n');
          custom = true;
          node.children.forEach((child) => {
            if (child.type !== 'set' && child.type !== 'js' && !written) {
              emit('return function(props, $$yield) {\n');
              written = true;
            }
            walk(child);
          });
          custom = false;
          emit('}\n');
          emit('});\n');
          fileList[fileIdx].tags[node.data.name] = node.children;
        } break;
        case 'tag': {
          if (!write && !custom) {
            const isBody = node.data.name === 'body';
            if (isBody) {
              emit('$sync = function () {\n');
              emit('if ($$is_syncing === false) {\n');
              emit('$$is_syncing = true;\n');
              emit(`$$nodes.push({ ref: document.body, processed: 0 });\n`);
              write = true;
            }
            if (fileList[fileIdx].tags[node.data.name]) {
              yields.push(() => {
                node.children.forEach(walk);
              });
              fileList[fileIdx].tags[node.data.name].forEach((child) => {
                if (child.type !== 'set' && child.type !== 'js') {
                  walk(child);
                }
              });
              yields.pop();
            } else {
              node.children.forEach(walk);
            }
            if (isBody) {
              emit('$$clean();\n');
              emit('$$clean_states();\n');
              emit('$$is_syncing = false;\n');
              emit('}\n');
              emit('};\n');
              write = false;
            }
            break;
          }
          const attr = node.data.attributes;
          const evts = node.data.events;
          if (fileList[fileIdx].tags[node.data.name]) {
            emit('$');
            emit(node.data.name);
            emit('({');
          } else {
            emit('$$e("');
            emit(node.data.name);
            emit('", {');
          }
          for (let a in attr) {
            emit('"');
            emit(a);
            emit('": ');
            walk(attr[a]);
            emit(', ');
          }
          emit('}, {');
          for (let e of evts) {
            emit('"');
            emit(e.type);
            emit('": function($e) {');
            emit(e.handler);
            emit('; $sync(); }, ');
          }
          emit('}');
          if (node.children.length) {
            emit(', function () {\n');
            node.children.forEach(walk);
            emit('});\n');
          } else {
            emit(');\n')
          }
        } break;
        case 'textnode': {
          if (!write && !custom) {
            break;
          }
          emit('$$e("text", ');
          walk(node.data);
          emit(', {});')
        } break;
        case 'set': {
          emit('var ');
          emit(node.data.lhs.data);
          emit(' = ');
          walk(node.data.rhs);
          emit(';\n');
        } break;
        case 'null':
          emit('null');
          break;
        case 'ident':
        case 'number':
        case 'bool':
          emit(node.data.toString());
          break;
        case 'chunk':
          emit('"' + node.data.replace(/"/g, '\\"').replace(/(\r\n|\n|\r)/gm, '\\n') + '"');
          break;
        case 'string':
          node.data.forEach(function (c, i) {
            walk(c);
            if (i < node.data.length - 1) {
              emit(' + ');
            }
          });
          break;
        case 'accumulator': {
          walk(node.data[0]);
          for (let i = 1; i < node.data.length; i++) {
            emit('[');
            walk(node.data[i]);
            emit(']');
          }
        } break;
        case 'array': {
          emit('[');
          node.data.forEach((i) => {
            walk(i);
            emit(', ');
          });
          emit(']');
        } break;
        case 'object': {
          const keys = Object.keys(node.data);
          emit('{');
          keys.forEach((k) => {
            emit(`"${k}": `)
            walk(node.data[k]);
            emit(', ');
          });
          emit('}');
        } break;
        case 'ternary': {
          emit('((');
          walk(node.data[0]);
          emit(')?(');
          walk(node.data[1]);
          emit('):(');
          walk(node.data[2]);
          emit('))');
        } break;
        case 'unop': {
          emit('(');
          walk(node.data);
          emit('(');
        } break;
        case 'binop': {
          emit('(');
          walk(node.data[0]);
          emit(node.op);
          walk(node.data[1]);
          emit(')');
        } break;
        case 'parenthetical': {
          emit('(');
          emit(node.data);
          emit(')');
        } break;
        case 'pipe': {
          switch(node.data[0]) {
            case 'repeat': {
              emit('$$repeat(');
              walk(node.data[1]);
              emit(', ');
              walk(node.data[2]);
              emit(')');
            } break;
            case 'length': {
              walk(node.data[1]);
              emit('.length');
            } break;
            case 'map':
            case 'filter': {
              walk(node.data[1]);
              emit('.');
              walk(node.data[0]);
              emit('(function (_a, _b) { return ');
              walk(node.data[2]);
              emit('; })');
            } break;
            case 'toupper': {
              emit('(');
              walk(node.data[1]);
              emit(').toUpperCase()');
            } break;
            case 'tolower': {
              emit('(');
              walk(node.data[1]);
              emit(').toLowerCase()');
            } break;
            case 'split': {
              emit('(');
              walk(node.data[1]);
              emit(').split(');
              walk(node.data[2]);
              emit(')');
            } break;
            case 'includes': {
              emit('((');
              walk(node.data[1]);
              emit(').indexOf(');
              walk(node.data[2]);
              emit(') > -1)');
            } break;
            case 'indexof': {
              emit('(');
              walk(node.data[1]);
              emit(').indexOf(');
              walk(node.data[2]);
              emit(')');
            } break;
            case 'reverse': {
              emit('(Array.isArray(');
              walk(node.data[1]);
              emit(') ? (');
              walk(node.data[1]);
              emit(').reverse() : (');
              walk(node.data[1]);
              emit(").split('').reverse().join(''))");
            } break;
            case 'tojson': {
              emit('JSON.parse(');
              walk(node.data[1]);
              emit(')');
            } break;
            case 'replace': {
              emit('(');
              walk(node.data[1]);
              emit(').replace(');
              walk(node.data[2]);
              emit(', ');
              walk(node.data[3]);
              emit(')');
            } break;
            case 'replaceall': {
              emit('(');
              walk(node.data[1]);
              emit(').replaceAll(');
              walk(node.data[2]);
              emit(', ');
              walk(node.data[3]);
              emit(')');
            } break;
            case 'tostring': {
              emit('(typeof (');
              walk(node.data[1]);
              emit(") === 'object' ? stringify(");
              walk(node.data[1]);
              emit(') : (');
              walk(node.data[1]);
              emit(').toString())');
            } break;
            case 'join': {
              emit('(');
              walk(node.data[1]);
              emit(').join(');
              walk(node.data[2]);
              emit(')');
            } break;
            case 'keys': {
              emit('Object.keys(');
              walk(node.data[1]);
              emit(')');
            } break;
            case 'values': {
              emit('Object.values(');
              walk(node.data[1]);
              emit(')');
            } break;
            default:
              break;
          }
        }
        default:
          break;
      }
    }


    createFileList(ast);

    emit(`document.addEventListener('DOMContentLoaded', function () {\n`);
    emit(`var $$adom_input_state = ${JSON.stringify(incoming_state)};\n`);
    emit(`${adom_runtime}`);
    emit(`(function (${Object.keys(incoming_state).join(', ')}) {\n`);
    emit('var $sync = function () {};');

    fileList.forEach((file, i) => {
      const children = file.ast.children;
      fileIdx = i;
      emit('var $f');
      emit(i);
      emit(' = function () {\n');
      emit('var $components = {};\n');
      children.forEach((child) => {
        walk(child);
      });
      emit('return { components: $components };\n');
      emit('}();\n');
    });

    emit('$sync();\n');
    emit(`})(${Object.keys(incoming_state).map(k => `$$adom_input_state.${k}`).join(', ')});\n`);
    emit('});\n');

    return out[0];
  };

  Adom.prototype.generateRuntime = function (ast, incoming_state) {
    let output = [{ transform: false, code: '' }];
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
    let initial_state = [];

    function print_expression (expr) {
      switch (expr.type) {
        case 'null':
          return expr.data;
        case 'ident':
        case 'number':
        case 'bool':
          return expr.data.toString();
        case 'chunk':
          return '"' + expr.data.replace(/"/g, '\\"').replace(/(\r\n|\n|\r)/gm, '\\n') + '"';
        case 'string': {
          return expr.data.map(function (c) {
             return print_expression(c)
          }).join(' + ');
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
        case 'pipe': {
          switch(expr.data[0]) {
            case 'repeat': {
              return `$$repeat(${print_expression(expr.data[1])}, ${print_expression(expr.data[2])})`;
            } break;
            case 'length': {
              return `(${print_expression(expr.data[1])}).length`;
            } break;
            case 'map':
            case 'filter': {
              const t = expr.data[0];
              const l = expr.data[1];
              const r = expr.data[2];
              return `${print_expression(l)}.${t}(function (_1, _2) { return ${print_expression(r)}; })`
            } break;
            case 'toupper': {
              return `(${print_expression(expr.data[1])}).toUpperCase()`;
            } break;
            case 'tolower': {
              return `(${print_expression(expr.data[1])}).toLowerCase()`;
            } break;
            case 'split': {
              const e2 = expr.data[2];
              return `(${print_expression(expr.data[1])}).split(${print_expression(e2)})`;
            } break;
            case 'includes': {
              const e2 = expr.data[2];
              return `((${print_expression(expr.data[1])}).indexOf(${print_expression(e2)}) > -1)`;
            } break;
            case 'indexof': {
              const e2 = expr.data[2];
              return `(${print_expression(expr.data[1])}).indexOf(${print_expression(e2)})`;
            } break;
            case 'reverse': {
              const e = expr.data[1];
              const pe = print_expression(e);
              return `(Array.isArray(${pe}) ? (${pe}).reverse() : (${pe}).split('').reverse().join(''))`;
            } break;
            case 'tojson': {
              return `JSON.parse(${print_expression(expr.data[1])})`;
            } break;
            case 'replace': {
              const l = expr.data[1];
              const r = expr.data[2];
              const v = expr.data[3];
              return `(${print_expression(l)}).replace(${print_expression(r)}, ${print_expression(v)})`;
            } break;
            case 'replaceall': {
              const l = expr.data[1];
              const r = expr.data[2];
              const v = expr.data[3];
              return `(${print_expression(l)}).replaceAll(${print_expression(r)}, ${print_expression(v)})`;
            } break;
            case 'tostring': {
              const e = expr.data[1];
              const pe = print_expression(e);
              return `(typeof (${pe}) === 'object' ? JSON.stringify(${pe}) : (${pe}).toString())`;
            } break;
            case 'join': {
              const l = expr.data[1];
              const r = expr.data[2];
              return `(${print_expression(l)}).join(${print_expression(r)})`;
            } break;
            case 'keys': {
              return `Object.keys(${print_expression(expr.data[1])})`;
            } break;
            case 'values': {
              return `Object.values(${print_expression(expr.data[1])})`;
            } break;
          }
        } break;
      }
    }

    function fmt() {
      return '  '.repeat(indents);
    }

    function event2 (e) {
      let sync = e.sync ? '$sync();' : '';
      return `"${e.type}": function ($e) { ${e.handler}; ${sync} }`;
    }

    function event_object (events) {
      if (events.length) return `{${events.map(e => event2(e)).join(',')}}`;
      else return '{}';
    }

    function attribute_object(data) {
      const obj = data.attributes;
      if (obj['bind:value']) {
        let tval = '$e.target.value;'
        if (obj.type && print_expression(obj.type) === '"number"') {
          tval = 'parseInt($e.target.value);';
        }
        const v = obj['bind:value'];
        obj.value = v;
        // maybe a 'change' event here instead of 'input'
        data.events.push({ type: 'input', handler: `${print_expression(v)} = ${tval}`, sync: true });
        delete obj['bind:value'];
      }
      return `{${Object.keys(obj).map((k, i) => `"${k}": ${print_expression(obj[k])}`).join(', ')}}`
    }

    function render_line (str, indent = 0) {
      if (indent === -1) {
        indents--;
        output[output.length - 1].code += `${fmt()}${str}\n`;
      } else {
        output[output.length - 1].code += `${fmt()}${str}\n`;
        indents += indent; 
      }
    }

    function render_component2 (name, t) {
      let sk = Object.keys(t.state);
      render_line(`var $${name} = $$c(function (props, $emit, $on) {`, 1);
      sk.forEach((k) => {
        render_line(`var ${k} = ${print_expression(t.state[k])};`);
      });
      output.push({ transform: true, code: '' });
      if (t.node.js) {
        t.node.js.split('\n').forEach(line => render_line(line));
      }
      output.push({ transform: false, code: '' });
      render_line('return function ($$id, props, $$yield) {', 1);
      in_tag = true;
      t.node.children.forEach(render_tag);
      in_tag = false;
      render_line('}', -1);
      render_line('});', -1);
    }

    function render_export (name) {
      render_line(`$components.${name} = $${name};`);
    }

    function render_import (data, exp) {
      for (let e of exp) {
        render_line(`var $${e} = $${data.name}.components.${e};`);
      }
    }

    function tid () {
      return `a-${tag_id++}`;
    }

    function generate_id () {
      const indexes = [];
      if (in_tag) {
        indexes.push(`$$id`);
      }
      if (loop_depth) {
        indexes.push(`'${tid()}'`);
        for (let i = 0; i < loop_depth; i++) {
          indexes.push(`__index${i}`);
        }
      } else {
        indexes.push(`'${tid()}'`);
      }
      return indexes.join(" + '-' + ");
    }

    function render_tag (el) {
      if (el.type === 'tag') {
        let attr = attribute_object(el.data);
        let events = event_object(el.data.events);
        let id = generate_id();
        let n = el.data.name;
        let start = tag_ctx[n] ? `$${n}(` : `$$e("${n}", `;
        if (el.children.length > 0) {
          render_line(`${start}${id}, ${attr}, ${events}, function () {`, 1);
          el.children.forEach(render_tag);
          render_line(`});`, -1);
        } else {
          render_line(`${start}${id}, ${attr}, ${events});`);
        }
      } else if (el.type === 'textnode') {
        render_line(`$$e('text', '${tid()}', ${print_expression(el.data)}, {});`);
      } else if (el.type === 'yield') {
        render_line(`$$yield();`);
      } else if (el.type === 'each') {
        loop_depth++;
        let it = el.data.iterators.concat([`__index${loop_depth-1}`]);
        render_line(`$$each(${print_expression(el.data.list)}, function (${it.filter(i => i).join(',')}) {`, 1);
        el.children.forEach(render_tag);
        loop_depth--;
        render_line(`});`, -1);
      } else if (el.type === 'if') {
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

    function walk (node, yieldfn) {
      if (node.type === 'file') {
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
          f.imports.push({ name: n });
        }
      } else if (node.type === 'export') {
        let f = file_stack[file_stack.length - 1];
        f.exports.push(node.data.name);
        node.children.forEach(walk);
      } else if (node.type === 'custom') {
        let f = file_stack[file_stack.length - 1];
        let t = { node };
        f.tags[node.data.name] = t;
        tag_state = {};
        in_tag = true;
        node.children.forEach(walk);
        in_tag = false;
        t.state = tag_state;
        tag_state = {};
      } else if (node.type === 'set') {
        if (in_tag) {
          tag_state[node.data.lhs.data] = node.data.rhs;
        } else {
          initial_state.push(`var ${node.data.lhs.data} = ${print_expression(node.data.rhs)};`);
        }
      } else if (node.type === 'tag') {
        const f = file_stack[file_stack.length - 1];
        if (node.data.name === 'body') {
          f.sync = node.children;
        } else if (f.tags[node.data.name]) {
          f.tags[node.data.name].node.children.forEach((child) => {
            walk(child, () => {
              node.children.forEach(walk);
            });
          });
        } else {
          node.children.forEach(walk);
        }
      } else if (node.type === 'yield') {
        if (yieldfn && typeof yieldfn === 'function') {
          yieldfn();
        }
      }
    }

    function render_files (files) {
      render_line(`document.addEventListener('DOMContentLoaded', function () {`, 1);
      render_line(`var $$adom_input_state = ${JSON.stringify(incoming_state)};`);
      render_line(`${adom_runtime}`);
      render_line(`(function (${Object.keys(incoming_state).join(', ')}) {`, 1);
      render_line('var $sync = function () {};');
      initial_state.forEach((line) => render_line(line));
      for (let name in files) {
        let file = files[name];
        tag_ctx = {...file.tags};
        for (let i of file.imports) {
          f = files[i.name];
          for (let t of f.exports) {
            tag_ctx[t] = f.tags[t];
          }
        }
        render_line(`var $${name} = (function () {`, 1);
        render_line('var $components = {};');
        for (let i of file.imports) {
          render_import(i, files[i.name].exports);
        }
        if (file.js) {
          output.push({ transform: true, code: '' });
          file.js.split('\n').forEach(line => render_line(line));
          output.push({ transform: false, code: '' });
        }
        for (let t in file.tags) {
          render_component2(t, file.tags[t]);
        }
        for (let e of file.exports) {
          render_export(e);
        }
        if (file.sync) {
          render_line('$sync = function () {', 1);
          render_line('if ($$is_syncing === false) {', 1);
          render_line('$$is_syncing = true;');
          render_line(`$$nodes.push({ ref: document.body, processed: 0 });`);
          for (let c of file.sync) {
            render_tag(c);
          }
          render_line('$$clean();');
          render_line('$$clean_states();');
          render_line('$$is_syncing = false;');
          render_line('}', -1);
          render_line('};', -1);
        }
        render_line('return { components: $components }');
        render_line('})();', -1);
      }
      render_line(`$sync();`);
      render_line(`})(${Object.keys(incoming_state).map(k => `$$adom_input_state.${k}`).join(', ')});`, -1);
      render_line(`});`, -1);
    }

    walk(ast);
    render_files(files);
    return output;
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

  Adom.prototype.generateAst = function (file) {
    let f = this.openFile(file);
    let tokens = this.tokenize(f.text, f.name);
    let ast = this.parse(tokens);
    return ast;
  };

  Adom.prototype.processJs = async function (js) {
    const esbuild = require('esbuild');

    await Promise.all(js.map(async (chunk, index) => {
      if (chunk.transform) {
        const opts = { format: 'cjs', loader: 'ts' };
        const result = await esbuild.transform(chunk.code, opts);
        js[index].code = result.code;
      }
    }));
    const content = js.map((chunk) => chunk.code);
    const result = await esbuild.build({
      stdin: {
        contents: content.join('\n'),
        resolveDir: this.dirname
      },
      bundle: true,
      minify: this.minify,
      write: false
    });
    return result.outputFiles[0].text;
  };

  async function makePretty(js) {
    const esbuild = require('esbuild');
    const result = await esbuild.transform(js, { format: 'cjs', loader: 'ts' });
    return result.code;
  }

  Adom.prototype.render = async function (file, input_state) {
    let html;
    try {
      let cacheKey = this.getPath(file);
      let html;

      if (this.cache && this.ast_cache[cacheKey]) {
        html = this.execute(this.ast_cache[cacheKey], input_state || {});
      } else {
        let ast = this.generateAst(file);
        let runtime = this.generateRuntime(ast, input_state || {});
        ast.data.runtime = await this.processJs(runtime);
        ast.data.runtime = await makePretty(this.generateRuntime2(ast, {}));
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

  return Adom;
})();

if (typeof module !== 'undefined') {
  module.exports = Adom
} else {
  window.Adom = Adom
}
