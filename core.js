/*
 * Copyright 2023 Matthew Levenstein
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the “Software”),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
 * PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
 * USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

const fs = require('fs');
const path = require("path");

module.exports = (config) => {
  const _files = {};

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
    'circle',
    'clipPath',
    'color-profile',
    'cursor',
    'defs',
    'desc',
    'ellipse',
    'feBlend',
    'feColorMatrix',
    'feComponentTransfer',
    'feComposite',
    'feConvolveMatrix',
    'feDiffuseLighting',
    'feDisplacementMap',
    'feDistantLight',
    'feFlood',
    'feFuncA',
    'feFuncB',
    'feFuncG',
    'feFuncR',
    'feGaussianBlur',
    'feImage',
    'feMerge',
    'feMergeNode',
    'feMorphology',
    'feOffset',
    'fePointLight',
    'feSpecularLighting',
    'feSpotLight',
    'feTile',
    'feTurbulence',
    'filter',
    'font',
    'font-face',
    'font-face-format',
    'font-face-name',
    'font-face-src',
    'font-face-uri',
    'foreignObject',
    'g',
    'glyph',
    'glyphRef',
    'hkern',
    'image',
    'line',
    'linearGradient',
    'marker',
    'mask',
    'metadata',
    'missing-glyph',
    'mpath',
    'path',
    'pattern',
    'polygon',
    'polyline',
    'radialGradient',
    'rect',
    'script',
    'set',
    'stop',
    'style',
    'svg',
    'switch',
    'symbol',
    'text',
    'textPath',
    'title',
    'tref',
    'tspan',
    'use',
    'view',
    'vkern',
    // end svg tags
  ]


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

  const getPathInfo = (p, base) => {
    const full = base ? path.resolve(base, p) : path.resolve(p);
    const parent = path.dirname(full);
    return {
      full,
      parent
    };
  };

  const openFile = (name) => {
    const text = fs.readFileSync(name).toString();
    _files[name] = text;
    return text;
  };

  const resolveNodeModule = (name) => {
    let filepath = null;
    for (const p of module.paths) {
      const f = path.join(p, name) + '.adom';
      if (fs.existsSync(f)) {
        filepath = f;
        break;
      }
      const dir = path.join(p, name, 'index.adom');
      if (fs.existsSync(dir)) {
        filepath = dir;
        break;
      }
      const package = path.join(p, name, 'package.json');
      if (fs.existsSync(package)) {
        const packageJson = JSON.parse(fs.readFileSync(package, 'utf8'));
        if (packageJson.main) {
          const mainFilePath = path.join(p, name, packageJson.main);
          if (fs.existsSync(mainFilePath)) {
            filepath = mainFilePath;
            break;
          }
        }
      }
    }
    return filepath;
  }

  const tokenize = (prog, file, offset) => {
    let cursor = 0, end_pos = prog.length - 1;
    let tokens = [{ type: "file_begin", data: file, pos: 0, file: file }];
    let keywords = [
      "tag",
      "each",
      "if",
      "in",
      "else",
      "import",
      "yield",
      "on",
      "export",
      "file",
      "const",
      "let",
      "nosync",
      "as",
      "global"
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
          i += 2;
          pos = cursor + i - 1;
        } else if (text[i] === "}" && text[i+1] === "}" && in_expr === true) {
          in_expr = false;
          chunk += "}}";
          let toks = tokenize(chunk, file, pos);
          toks.shift(); //file_begin
          toks.pop(); //eof
          toks.forEach(function(t) {
            chunks.push(t);
          });
          chunk = "";
          i += 2;
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
      } else if (c === "/" && prog[cursor + 1] === "*") {
        let i = cursor + 2;
        while (true) {
          if (i >= end_pos) break;
          if (prog[i] === '*' && prog[i+1] === '/') {
            i += 2;
            break;
          }
          i++;
        }
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
      } else if (c === "<" && prog[cursor + 1] === "=" && prog[cursor + 2] === ">") {
        tok.type = "<=>";
        tok.data = "<=>";
        cursor += 3;
      } else if (c === ":" && prog[cursor + 1] === ":") {
        tok.type = "::";
        tok.data = "::";
        cursor += 2;
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
        let chunks = break_into_chunks(text, cursor);
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

  const parse = (tokens) => {
    let tok = tokens[0];
    let cursor = 0;
    let in_tag = false;
    let ast = { type: 'file', data: { file: tok.file }, children: [] };
    let parent = ast;

    function ast_node(type, data) {
      let node = { type, data, children: [] };
      parent.children.push(node);
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
      'todata': 0,
      'replace': 2,
      'tostring': 0,
      'join': 1,
      'keys': 0,
      'values': 0,
      'trim': 0,
      'sin': 0,
      'cos': 0,
      'tan': 0,
      'sqrt': 0,
      'ceil': 0,
      'floor': 0,
      'rand': 0,
      'slice': 2
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

    function parse_attributes() {
      let attr = {};
      let events = [];
      while (true) {
        let key = tok.data;
        if (accept("ident") || accept("as")) {
          // allow ':' in attribute names
          while (accept(':')) {
            key += ':'
            key += tok.data;
            expect("ident");
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
      let ns = null;
      expect("ident");
      if (accept('::')) {
        ns = name;
        name = tok.data;
        expect('ident');
      }
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
        namespace: ns,
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
      } else if (peek("yield")) {
        ast_node('yield', { pos: tok.pos, file: tok.file });
        next();
        parse_tag_list();
      } else if (in_tag && (peek('global') || peek('const') || peek('let'))) {
        parse_assignment();
        parse_tag_list();
      } else if (in_tag && peek('js_context')) {
        parent.js = tok.data;
        ast_node('js', { js: tok.data, pos: tok.pos, file: tok.file });
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
        const t = tok;
        const curr = getPathInfo(tok.file);
        const pathInfo = getPathInfo(parse_strict_string(), curr.parent);
        let file;
        try {
          file = openFile(pathInfo.full);
        } catch (e) {
          throw_adom_error({
            msg: e.message,
            pos: t.pos,
            file: t.file
          });
        }
        val = {
          pos: tok.pos,
          file: tok.file,
          type: 'string',
          data: [{ type: 'chunk', data: file }]
        };
      } else {
        val = parse_expr();
      }
      return val;
    }

    function parse_assignment () {
      const global = tok.data === 'global';
      next();
      let dst = { data: tok.data, pos: tok.pos, file: tok.file };
      expect('ident');
      accept("=");
      let val = parse_rhs();
      ast_node('set', {
        global,
        lhs: dst,
        rhs: val
      });
    }

    function parse_file () {
      while (true) {
        if (tok.type === "file_begin") {
          next();
        } else if (tok.type === "eof") {
          if (!next()) {
            break;
          }
        } else if (accept('import')) {
          const t = tok;
          const curr = getPathInfo(tok.file);
          const pathStr = parse_strict_string();
          let ns;
          if (accept('as')) {
            ns = tok.data;
            expect('ident');
          }
          let pathInfo = { full: null };
          if (pathStr[0] !== '.' && pathStr.indexOf('.adom') === -1) {
            pathInfo.full = resolveNodeModule(pathStr);
          }
          if (!pathInfo.full) {
            pathInfo = getPathInfo(pathStr, curr.parent);
          }
          let file;
          try {
            file = openFile(pathInfo.full);
          } catch (e) {
            throw_adom_error({
              msg: e.message,
              pos: t.pos,
              file: t.file
            });
          }
          let toks = tokenize(file, pathInfo.full);
          let _ast = parse(toks);
          if (ns) _ast.data.namespace = ns;
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
        } else if (tok.type === "ident") {
          parse_tag_list();
        } else if (peek("tag")) {
          parse_custom_tag();
        } else if (peek('const') || peek('let') || peek('global')) {
          parse_assignment();
        } else if (peek('js_context')) {
          ast_node('js', { js: tok.data, pos: tok.pos, file: tok.file });
          js_found = true;
          next();
        } else {
          throw_adom_error({ msg: "unexpected: " + tok.type, pos: tok.pos, file: tok.file });
        }
      }
    }

    parse_file();

    return ast;
  };

  const execute = (ast, initial_state, js, flush) => {
    let html = '';

    const stack = [];
    const ctx = [];
    const globals = { data: initial_state };

    let inScript = false;
    let inStyle = false;

    const found = { head: false, head: false, body: false };

    const emit = flush ? (txt) => {
      if (html.length > 100) {
        flush(html);
        html = txt;
      } else {
        html += txt; 
      }
    } : (txt) => {
      html += txt;
    };

    const getType = (v) => {
      if (Array.isArray(v)) return 'array';
      if (v === null) return null;
      if (typeof v === 'object') return 'object';
      if (typeof v === 'string') return 'string';
      if (typeof v === 'number') return 'number';
      if (typeof v === 'boolean') return 'boolean';
      return 'undefined';
    };

    const evaluate = (n) => {
      walk(n);
      return stack.pop();
    };

    const err = (msg, node) => {
      throw_adom_error({ msg, file: node.file, pos: node.pos });
    };

    const escapeHTML = (txt) => {
      return txt.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    const assertType = (v, t, n) => {
      const type = getType(v);
      if (typeof t === 'string') t = [t];
      if (t.indexOf(type) === -1) {
        err(`Expected ${t.join('|')}, got ${type}`, n);
      }
    };

    const walk = (node) => {
      switch (node.type) {
        case 'custom': {
          ctx[ctx.length - 1].tags[node.data.name] = {
            ctx: ctx[ctx.length - 1],
            children: node.children
          };
        } break;
        case 'file': {
          const namespace = node.data.namespace;
          ctx.push({
            state: [{}],
            yield: null,
            tags: {},
            namespaces: {},
            children: node.children,
            exports: []
          });
          node.children.forEach(walk);
          const c = ctx.pop();
          if (namespace) {
            const ns = {};
            ctx[ctx.length - 1].namespaces[namespace] = ns;
            c.exports.forEach((e) => {
              ns[e] = c.tags[e];
            });
          } else {
            c.exports.forEach((e) => {
              ctx[ctx.length - 1].tags[e] = c.tags[e];
            });
          }
        } break;
        case 'export': {
          if (!ctx[ctx.length - 1].tags[node.data.name]) {
            err(`Undefined tag: ${node.data.name}`, node.data);
          }
          ctx[ctx.length - 1].exports.push(node.data.name);
        } break;
        case 'tag': {
          const c = ctx[ctx.length - 1];
          const attr = node.data.attributes;
          const namespace = node.data.namespace;
          let custom = c.tags[node.data.name];
          if (namespace) {
            const ns = c.namespaces[namespace];
            if (ns[node.data.name]) {
              custom = ns[node.data.name];
            }
          }
          if (custom) {
            const props = {};
            for (let a in attr) {
              props[a] = evaluate(attr[a]);
            }
            ctx.push({
              state: [custom.ctx.state[0], { props }],
              yield: () => {
                const ref = ctx.pop();
                node.children.forEach(walk);
                ctx.push(ref);
              },
              tags: custom.ctx.tags,
              children: node.children
            });
            custom.children.forEach(walk);
            ctx.pop();
            break;
          }
          // todo: html -> head, body enforcement
          if (valid_tags.indexOf(node.data.name) === -1) {
            err(`Invalid tag: ${node.data.name}`, node.data);
          }
          if (node.data.name === 'script') {
            inScript = true;
          }
          if (node.data.name === 'style') {
            inStyle = true;
          }
          if (node.data.name === 'html') {
            emit('<!DOCTYPE html>');
          }
          emit('<');
          emit(node.data.name);
          for (let a in attr) {
            let val = evaluate(attr[a]);
            const t = getType(val);
            if (val !== false || a === 'innerHTML') {
              emit(' ');
              emit(a.replace('bind:', ''));
              emit('="');
              if (t === 'array') {
                val = val.map((c) => {
                  if (getType(c) === 'object') {
                    return Object.keys(c).filter((k) => c[k]).join(' ');
                  }
                  return c;
                }).join(' ');
              } else if (t === 'object') {
                val = Object.keys(val).filter((k) => v[k]).join(' ');
              } else if (t === 'string') {
                val = val.replace(/"/g, '&quot;');
              }
              emit(val);
              emit('"');
            }
          }
          emit('>');
          if (void_tags.indexOf(node.data.name) === -1) {
            if (node.data.name === 'html') {
              if (found.html) err('html tag may only be used once', node.data);
              found.html = true;
            } else if (!found.html) {
              err('html tag must be the first tag printed', node.data);
            } else if (node.data.name === 'head') {
              if (found.head) err('head tag may only be used once', node.data);
              found.head = true;
            } else if (node.data.name === 'body') {
              if (!found.head) err('Expected head tag', node.data);
              if (found.body) err('body tag may only be used once', node.data);
              found.body = true;
            }
            node.children.forEach(walk);
            if (node.data.name === 'head') {
              if (js) {
                emit('<script>(function (data) {');
                emit(js);
                emit('})(');
                emit(JSON.stringify(initial_state));
                emit(');<' + '/' + 'script>');
              } else {
                const rt = `(function (data){${js}})(${JSON.stringify(initial_state)})`;
                emit('<script>' + rt + '<' + '/script>');
              }
            }
            emit('</');
            emit(node.data.name);
            emit('>');
            inScript = false;
          }
        } break;
        case 'if': {
          if (evaluate(node.data)) {
            walk(node.children[0]);
          } else if (node.children[1]) {
            walk(node.children[1]);
          }
        } break;
        case 'each': {
          const it = node.data.iterators;
          const val = evaluate(node.data.list);
          const t = getType(val);
          const s = {};
          ctx[ctx.length - 1].state.push(s);
          if (t === 'array' || t === 'string') {
            for (let i = 0; i < val.length; i++) {
              s[it[0]] = val[i];
              s[it[1]] = i;
              node.children.forEach(walk);
            }
          } else if (t === 'object') {
            const keys = Object.keys(val);
            for (let i = 0; i < keys.length; i++) {
              s[it[0]] = keys[i];
              s[it[1]] = val[keys[i]];
              node.children.forEach(walk);
            }
          } else {
            err('Value is not iterable', node.data.list);
          }
          ctx[ctx.length - 1].state.pop();
        } break;
        case 'yield': {
          const c = ctx[ctx.length - 1];
          if (c.yield) {
            c.yield();
          } else {
            err('Cannot yield outside of a custom tag', node.data);
          }
        } break;
        case 'set': {
          const k = node.data.lhs.data;
          const c = ctx[ctx.length - 1];
          if (node.data.global) {
            globals[k] = evaluate(node.data.rhs);
          } else {
            c.state[c.state.length - 1][k] = evaluate(node.data.rhs);
          }
        } break;
        case 'textnode': {
          if (inScript || inStyle) {
            emit(evaluate(node.data));
          } else {
            emit(escapeHTML(evaluate(node.data)));
          }
        } break;
        case 'null':
        case 'number':
        case 'bool':
        case 'chunk':
          stack.push(node.data);
          break;
        case 'string': {
          let str = '';
          node.data.forEach((c) => {
            // todo: make sure the top of the stack contains a scalar value
            str += evaluate(c);
          });
          stack.push(str);
        } break;
        case 'object': {
          const keys = Object.keys(node.data);
          const obj = {};
          keys.forEach((k) => {
            obj[k] = evaluate(node.data[k]);
          });
          stack.push(obj);
        } break;
        case 'array': {
          const data = [];
          node.data.forEach((d) => {
            data.push(evaluate(d));
          });
          stack.push(data);
        } break;
        case 'ident': {
          const v = node.data;
          const c = ctx[ctx.length - 1];
          let found = false;
          if (globals[v] !== undefined) {
            stack.push(globals[v]);
            break;
          }
          for (let i = c.state.length - 1; i >= 0; i--) {
            if (c.state[i][v] !== undefined) {
              stack.push(c.state[i][v]);
              found = true;
              break;
            }
          }
          if (!found) {
            err(v + ' is undefined', node);
          }
        } break;
        case 'accumulator': {
          let v = node.data[0];
          let prev = v.data;
          let ptr = evaluate(v);
          for (let i = 1; i < node.data.length; i++) {
            v = node.data[i];
            const str = evaluate(v);
            assertType(str, ['string', 'number'], node.data[i]);
            if (ptr == null) {
              err(prev + ' is not defined', node.data[i-1]);
            }
            prev = str;
            ptr = ptr[str];
          }
          stack.push(ptr);
        } break;
        case 'ternary': {
          const v0 = evaluate(node.data[0]);
          const v1 = evaluate(node.data[1]);
          const v2 = evaluate(node.data[2]);
          stack.push(v0 ? v1 : v2);
        } break;
        case 'unop': {
          const v = evaluate(node.data);
          assertType(v, 'number', node.data);
          if (node.op === '-') {
            stack.push(-v);
          } else if (node.op === '!') {
            stack.push(!v);
          }
        } break;
        case 'binop': {
          const op = node.op;
          let v1 = node.data[0];
          let v2 = node.data[1];
          if (op === '&&') {
            stack.push(evaluate(v1) && evaluate(v2));
            break;
          } else if (op === '||') {
            stack.push(evaluate(v1) || evaluate(v2));
            break;
          }
          v1 = evaluate(v1);
          v2 = evaluate(v2);
          if (op === '==') {
            stack.push(v1 === v2);
          } else if (op === '!=') {
            stack.push(v1 !== v2);
          } else if (op === '<=') {
            stack.push(v1 <= v2);
          } else if (op === '>=') {
            stack.push(v1 >= v2);
          } else if (op === '>') {
            assertType(v1, 'number', node.data[0]);
            assertType(v2, 'number', node.data[1]);
            stack.push(v1 > v2);
          } else if (op === '<') {
            assertType(v1, 'number', node.data[0]);
            assertType(v2, 'number', node.data[1]);
            stack.push(v1 < v2);
          } else if (op === '+') {
            assertType(v1, ['number','string'], node.data[0]);
            assertType(v2, ['number', 'string'], node.data[1]);
            stack.push(v1 + v2);
          } else if (op === '-') {
            assertType(v1, 'number', node.data[0]);
            assertType(v2, 'number', node.data[1]);
            stack.push(v1 - v2);
          } else if (op === '*') {
            assertType(v1, 'number', node.data[0]);
            assertType(v2, 'number', node.data[1]);
            stack.push(v1 * v2);
          } else if (op === '/') {
            assertType(v1, 'number', node.data[0]);
            assertType(v2, 'number', node.data[1]);
            stack.push(v1 / v2);
          } else if (op === '%') {
            assertType(v1, 'number', node.data[0]);
            assertType(v2, 'number', node.data[1]);
            stack.push(v1 % v2);
          }
        } break;
        case 'parenthetical': {
          walk(node.data);
        } break;
        case 'pipe': {
          const op = node.data[0];
          switch (op) {
            case 'repeat': {
              const arr = [];
              const count = evaluate(node.data[2]);
              for (let i = 0; i < count; i++) {
                arr.push(evaluate(node.data[1]));
              }
              stack.push(arr);
            } break;
            case 'length': {
              const data = evaluate(node.data[1]);
              assertType(data, ['string', 'array'], node.data[1]);
              stack.push(data.length);
            } break;
            case 'filter':
            case 'map': {
              const t = node.data[0]; // map or filter
              const s = {};
              const l = evaluate(node.data[1]);
              const r = node.data[2];
              const c = ctx[ctx.length - 1];
              c.state.push(s);
              const res = l[t]((_a, _b) => {
                s._a = _a;
                s._b = _b;
                return evaluate(r);
              });
              stack.push(res);
              c.state.pop();
            } break;
            case 'toupper': {
              const val = evaluate(node.data[1]);
              assertType(val, 'string', node.data[1]);
              stack.push(val.toUpperCase());
            } break;
            case 'tolower': {
              const val = evaluate(node.data[1]);
              assertType(val, 'string', node.data[1]);
              stack.push(val.toLowerCase());
            } break;
            case 'split': {
              const val = evaluate(node.data[1]);
              const del = evaluate(node.data[2]);
              assertType(val, 'string', node.data[1]);
              assertType(del, 'string', node.data[2]);
              stack.push(val.split(del));
            } break;
            case 'includes': {
              const val = evaluate(node.data[1]);
              const del = evaluate(node.data[2]);
              stack.push(val.indexOf(del) > -1);
            } break;
            case 'indexof': {
              const val = evaluate(node.data[1]);
              const del = evaluate(node.data[2]);
              assertType(val, ['string', 'array'], node.data[1]);
              assertType(del, ['string', 'number'], node.data[2]);
              stack.push(val.indexOf(del));
            } break;
            case 'reverse': {
              const val = evaluate(node.data[1]);
              const t = getType(val);
              if (t === 'array') {
                stack.push(val.reverse());
              } else if (t === 'string') {
                stack.push(val.split('').reverse().join(''));
              } else {
                err(`Expected string or array`, node.data[1]);
              }
            } break;
            case 'todata': {
              const val = evaluate(node.data[1]);
              if (getType(val) === 'string') {
                if (!isNaN(val)) {
                  stack.push(parseFloat(val));
                } else {
                  try {
                    stack.push(JSON.parse(val));
                  } catch (_) {
                    stack.push(val);
                  }
                }
              } else {
                stack.push(val);
              }
            } break;
            case 'replace': {
              const e = evaluate(node.data[1]);
              const r = evaluate(node.data[2]);
              const n = evaluate(node.data[3]);
              assertType(e, 'string', node.data[1]);
              assertType(r, 'string', node.data[2]);
              assertType(n, 'string', node.data[3]);
              stack.push(e.replaceAll(r, n));
            } break;
            case 'slice': {
              const v = evaluate(node.data[1]);
              const s = evaluate(node.data[2]);
              const e = evaluate(node.data[3]);
              assertType(v, ['string', 'array'], node.data[1]);
              assertType(s, 'number', node.data[2]);
              assertType(e, 'number', node.data[3]);
              stack.push(v.slice(s, e));
            } break;
            case 'tostring': {
              const val = evaluate(node.data[1]);
              const t = getType(val);
              if (t === 'object' || t === 'null' || t === 'array') {
                return JSON.stringify(val);
              } else {
                return e.toString();
              }
            } break;
            case 'join': {
              const val = evaluate(node.data[1]);
              const del = evaluate(node.data[2]);
              assertType(val, 'array', node.data[1]);
              assertType(del, 'string', node.data[2]);
              stack.push(val.join(del));
            } break;
            case 'trim': {
              const val = evaluate(node.data[1]);
              assertType(val, 'string', node.data[1]);
              stack.push(val.trim());
            } break;
            case 'keys': {
              const val = evaluate(node.data[1]);
              assertType(val, 'object', node.data[1]);
              stack.push(Object.keys(val));
            } break;
            case 'values': {
              const val = evaluate(node.data[1]);
              assertType(val, 'object', node.data[1]);
              stack.push(Object.values(val));
            } break;
            case 'sin':
            case 'cos':
            case 'tan':
            case 'sqrt':
            case 'ceil':
            case 'floor': {
              const val = evaluate(node.data[1]);
              assertType(val, 'number', node.data[1]);
              stack.push(Math[op](val));
            } break;
            case 'rand': {
              const val = evaluate(node.data[1]);
              assertType(val, 'number', node.data[1]);
              stack.push(Math.random() * val);
            } break;
            default:
              break;
          }
        } break;
        default: {
          if (node.children) {
            node.children.forEach(walk);
          }
        } break;
      }
    };
  
    walk(ast);

    if (flush && html.length > 0) {
      flush(html);
    }

    return html;
  };

  const printError = (err) => {
    let prog = _files[err.file];
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
        : a != null && typeof a === 'object' ? Object.keys(a).filter(function (k) {
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
    if (Array.isArray(list) || typeof list === 'string') {
      for (var i = 0; i < list.length; i++) {
        fn(list[i], i, i);
      }
    } else if (typeof list === 'object' && list != null) {
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

  function $$e (type, id, attrs, events, children) {
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

  function $$todata(val) {
    if (typeof val === 'string') {
      if (!isNaN(val)) {
        return parseFloat(val);
      } else {
        try {
          return JSON.parse(val);
        } catch (e) {
          return val;
        }
      }
    } else {
      return val;
    }
  }

  function $call() {
    var args = Array.prototype.slice.apply(arguments);
    var name = args.shift();
    return fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'ADOM_SERVER_FUNCTION',
        name: name,
        args: args
      })
    }).then(function (data) {
      return data.json();
    });
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
    return function (id, props, events, yield_fn) {
      var $state = $$states[id];
      var isNew = false;
      var newp = JSON.stringify(props);
      if (!$state) {
        $state = { events: {}, props: newp, props_ptr: props };
        $state.body = init(props, $$emit_event.bind($state), function (event, cb) {
          $$set_event($state.events, event, cb);
        });
        for (var event in events) {
          $$set_event($state.events, event, events[event]);
        }
        isNew = true;
      }
      const oldp = $state.props;
      $$emit_event.call($state, 'prerender');
      if (newp !== oldp) {
        $$emit_event.call($state, 'change', JSON.parse(oldp));
        for (let k in props) {
          $state.props_ptr[k] = props[k];
        }
      }
      $state.body(id, props, yield_fn);
      $state.props = newp;
      $$rendered[id] = true;
      $$states[id] = $state;
      if (isNew) {
        $$emit_event.call($state, 'mount');
      }
      $$emit_event.call($state, 'render');
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

  const generateRuntime = (ast, actions) => {
    const out = [{ code: '', transform: false }];
    const fileList = [];
    const fileIdMap = {};
    const globals = {};

    let custom = false;
    let fileIdx = -1;
    let loop_depth = 0;
    let tagId = 0;

    const emit = (txt) => {
      out[out.length - 1].code += txt;
      if (fileIdx > -1) {
        const n = fileList[fileIdx].name;
        out[out.length - 1].parent_dir = getPathInfo(n).parent;
      }
    };

    const createFileList = (node) => {
      if (node.type === 'file') {
        node.children.forEach((child) => {
          if (child.type === 'set' && child.data.global) {
            const g = globals[child.data.lhs.data];
            if (g && g === node.data.file) {
              throw_adom_error({
                msg: 'Global already declared',
                pos: node.data.pos,
                file: node.data.file
              });
            } else {
              globals[child.data.lhs.data] = node.data.file;
            }
          }
          createFileList(child);
        });
        if (fileIdMap[node.data.file] == null) {
          fileIdMap[node.data.file] = fileList.length;
          fileList.push({
            name: node.data.file,
            ast: node,
            exports: {},
            tags: {},
            namespaces: {}
          });
        }
      }
    };

    function idGen() {
      const indexes = [];
      if (custom) {
        indexes.push(`$$id`);
      }
      indexes.push(`'a-${tagId++}'`);
      for (let i = 0; i < loop_depth; i++) {
        indexes.push(`__index${i}`);
      }
      return indexes.join(" + '-' + ");
    }

    function walk(node) {
      switch (node.type) {
        case 'if': {
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
          emit('$$each(');
          walk(node.data.list);
          emit(', function (');
          let it = node.data.iterators.concat([`__index${loop_depth}`]);
          emit(it.filter(i => i).join(','));
          emit(') {\n');
          loop_depth++;
          node.children.forEach(walk);
          loop_depth--;
          emit('});\n');
        } break;
        case 'yield':
          emit('$$yield();');
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
          out.push({
            code: '',
            transform: true,
            pos: node.data.pos,
            file: node.data.file
          });
          emit(node.data.js);
          out.push({ code: '', transform: false });
          break;
        case 'file':
          const namespace = node.data.namespace;
          const id = fileIdMap[node.data.file];
          const ex = fileList[id].exports;
          if (namespace) {
            emit('var $');
            emit(namespace);
            emit(' = $f');
            emit(id);
            emit('.components;');
            const ns = {};
            fileList[fileIdx].namespaces[namespace] = ns;
            for (let e in ex) {
              ns[e] = fileList[id].tags[e];
            }
          } else {
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
          }
          break;
        case 'custom': {
          let written = false;
          emit('var $');
          emit(node.data.name);
          emit(' = $$c(function (props, $emit, $on) {\n');
          fileList[fileIdx].tags[node.data.name] = node.children;
          if (node.children.length) {
            custom = true;
            node.children.forEach((child) => {
              if (child.type !== 'set' && child.type !== 'js' && !written) {
                emit('return function($$id, props, $$yield) {\n');
                written = true;
              }
              walk(child);
            });
            custom = false;
            emit('}\n');
          }
          emit('});\n');
        } break;
        case 'tag': {
          const namespace = node.data.namespace;
          const attr = node.data.attributes;
          const evts = node.data.events;
          if (namespace) {
            const ns = fileList[fileIdx].namespaces[namespace];
            if (ns) {
              if (ns[node.data.name]) {
                emit('$');
                emit(namespace);
                emit('.')
                emit(node.data.name);
                emit('(');
                emit(idGen());
                emit(', {');
              } else {
                throw_adom_error({ msg: 'Invalid tag', pos: node.data.pos, file: node.data.file });
              }
            } else {
              throw_adom_error({ msg: 'Invalid namespace', pos: node.data.pos, file: node.data.file });
            }
          } else if (fileList[fileIdx].tags[node.data.name]) {
            emit('$');
            emit(node.data.name);
            emit('(');
            emit(idGen());
            emit(', {');
          } else {
            if (node.data.name === 'head') {
              break;
            }
            if (node.data.name === 'html' || node.data.name === 'body') {
              emit('(function () {');
              node.children.forEach(walk);
              emit('})();\n');
              break;
            }
            if (valid_tags.indexOf(node.data.name) === -1) {
              throw_adom_error({ msg: 'Invalid tag', pos: node.data.pos, file: node.data.file });
            }
            emit('$$e("');
            emit(node.data.name);
            emit('", ');
            emit(idGen());
            emit(', {');
          }
          for (let a in attr) {
            // todo: handle other values
            if (a === 'bind:value') {
              evts.push({ type: 'input', handler: `${attr[a].data} = $e.target.value;`, sync: true });
              attr.value = { type: 'ident', data: attr[a].data };
              a = 'value';
            }
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
            emit(`;${e.sync ? ' $sync();' : ''} }, `);
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
          emit('$$e("text", ');
          emit(idGen());
          emit(', ');
          walk(node.data);
          emit(', {});')
        } break;
        case 'set': {
          if (!node.data.global) {
            emit('var ');
          }
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
          emit(node.op);
          emit('(');
          walk(node.data);
          emit(')');
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
          walk(node.data);
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
              emit(node.data[0]);
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
            case 'todata': {
              emit('$$todata(');
              walk(node.data[1]);
              emit(')');
            } break;
            case 'replace': {
              emit('(');
              walk(node.data[1]);
              emit(').replaceAll(');
              walk(node.data[2]);
              emit(', ');
              walk(node.data[3]);
              emit(')');
            } break;
            case 'slice': {
              emit('(');
              walk(node.data[1]);
              emit(').slice(');
              walk(node.data[2]);
              emit(', ');
              walk(node.data[3]);
              emit(')');
            } break;
            case 'tostring': {
              emit('(typeof (');
              walk(node.data[1]);
              emit(") === 'object' ? JSON.stringify(");
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
            case 'trim': {
              emit('(');
              walk(node.data[1]);
              emit(').trim()');
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
            case 'sin':
            case 'cos':
            case 'tan':
            case 'sqrt':
            case 'ceil':
            case 'floor': {
              emit('Math.');
              emit(node.data[0]);
              emit('(');
              walk(node.data[1]);
              emit(')');
            } break;
            case 'rand': {
              emit('(Math.random() * ');
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
    emit(`${adom_runtime}`);
    emit('var $sync = function () {};\n');
    for (let g in globals) {
      emit('var ');
      emit(g);
      emit(';\n')
    }
    if (actions) {
      for (let a of actions) {
        emit(`var $${a} = $call.bind(undefined, '${a}');\n`);
      }
    }
    fileList.forEach((file, i) => {
      let written = false;
      const children = file.ast.children;
      fileIdx = i;
      emit('var $f');
      emit(i);
      emit(' = function () {\n');
      emit('var $components = {};\n');
      children.forEach((child) => {
        if (child.type === 'tag' && !written) {
          emit('$sync = function () {\n');
          emit('if ($$is_syncing === false) {\n');
          emit('$$is_syncing = true;\n');
          emit(`$$nodes.push({ ref: document.body, processed: 0 });\n`);
          written = true;
        }

        walk(child);
      });
      if (written) {
        emit('$$clean();\n');
        emit('$$clean_states();\n');
        emit('$$is_syncing = false;\n');
        emit('}\n');
        emit('};\n');
      }
      emit('return { components: $components };\n');
      emit('}();\n');
    });

    emit('$sync();\n');
    emit('});\n');

    return out;
  };

  const renderToAst = async (file, actions) => {
    const fileText = openFile(file);
    const tokens = tokenize(fileText, file);
    const ast = parse(tokens);
    const runtime = generateRuntime(ast, actions);
    let js;

    if (config.jsTransform) {
      js = (await Promise.all(runtime.map(async (chunk) => {
        if (chunk.transform) {
          return await config.jsTransform(chunk);
        }
        return chunk.code;
      }))).join('\n');
    } else {
      js = runtime.map((chunk) => chunk.code).join('\n');
    }

    if (config.jsPostProcess) {
      js = await config.jsPostProcess(js);
    }

    return { ast, js };
  };

  const renderToHTML = (ir, data, flush) => {
    if (typeof ir === 'string') {
      ir = JSON.parse(ir);
    }
    const html = execute(ir.ast, data || {}, ir.js, flush);
    return html;
  };

  const render = async (file, data, flush, actions) => {
    const result = await renderToAst(file, actions);
    const html = renderToHTML(result, data, flush);

    return html;
  };

  const renderToCache = async (file, actions) => {
    const result = await renderToAst(file, actions);
    return JSON.stringify(result);
  };

  return { render, renderToCache, renderToHTML, printError };
};

