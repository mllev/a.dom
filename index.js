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
const path = require('path');
const esbuild = require('esbuild');
const http = require('http');
const core = require('./core.js');

const ADOM = {};

const getPathInfo = (p, base) => {
  const full = base ? path.resolve(base, p) : path.resolve(p);
  const parent = path.dirname(full);
  return {
    full,
    parent
  };
};

const processJs = async (js, config) => {
  const addParentPathsToRequires = (code, par) => {
    const len = code.length;
    let out = '';
    for (let i = 0; i < len; i++) {
      if (code.slice(i, i+10) === 'require(".') {
        let f = '';
        i += 9; // right at the period
        while (code[i] !== '"') f += code[i++];
        out += `require("${path.resolve(par, f)}"`;
      } else {
        out += code[i];
      }
    }
    return out;
  };

  const content = await Promise.all(js.map(async (chunk) => {
    if (chunk.transform) {
      const code = chunk.code;
      try {
        const opts = { format: 'cjs', loader: 'ts' };
        const result = await esbuild.transform(code, opts);
        return addParentPathsToRequires(result.code, chunk.parent_dir);
      } catch (e) {
        if (e.errors && e.errors[0]) {
          let row = e.errors[0].location.line - 1;
          let col = e.errors[0].location.column;
          let pos;

          for (pos = 0; pos < code.length; pos++) {
            if (code[pos] === '\n') row--;
            if (row == 0) {
              if (col > 0) col--;
              else break;
            }
          }

          throw {
            origin: 'adom',
            msg: e.errors[0].text,
            pos: chunk.pos + 3 + pos + 1,
            file: chunk.file
          };
        } else {
          throw e;
        }
      }
    }
    return chunk.code;
  }));
  const result = await esbuild.build({
    stdin: {
      contents: content.join('\n'),
      resolveDir: config.parentDir
    },
    bundle: true,
    minify: config.minify,
    write: false
  });
  return result.outputFiles[0].text;
};

ADOM.compile = async (name, opts) => {
  const adom = core();
  if (name && typeof name === 'object') {
    opts = name;
  }
  if (!opts) opts = {};
  if (typeof name === 'string') {
    opts.input = name;
  }
  const parentDir = getPathInfo(opts.input).parent;
  try {
    const out = await adom.render(opts.input, opts.data);
    const js = await processJs(out.js, { parentDir, minify: opts.minify });
    const printed = `(function (data){${js}})(${JSON.stringify(opts.data || {})})`;
    const parts = out.html.split('/***ADOM_RUNTIME***/');
    const html = parts[0] + printed + parts[1];

    if (!opts.output) {
      return html;
    } else {
      fs.writeFileSync(opts.output, html);
    }
  } catch (e) {
    let msg;
    console.log(e);
    if (e.origin === 'adom') {
      msg = `<pre>${adom.error(e)}</pre>`;
    } else msg = `<pre>${e.message}</pre>`;
    if (!opts.output) return msg;
    else {
      fs.writeFileSync(opts.output, msg);
    }
  }
};

ADOM.serve = (opts) => {
  const mimedb = require('./mime.json');
  const adom = core();
  const port = opts.port || 5000;
  const dir = opts.publicDir || '.';
  const routes = opts.routes || {};
  const minify = opts.minify || false;
  const mimetypes = {};

  Object.keys(mimedb).forEach((type) => {
    if (mimedb[type].extensions) {
      mimedb[type].extensions.forEach((ext) => {
        mimetypes['.' + ext] = type;
      });
    }
  });

  return http.createServer(async (req, res) => {
    if (req.method === 'GET') {
      const p = req.url;
      if (routes[p]) {
        res.writeHead(200, {'Content-type': 'text/html; charset=utf-8' });
        res.end(await ADOM.compile({
          input: routes[p].path,
          data: routes[p].data,
          cache: false,
          minify
        }));
      } else {
        let p = path.resolve(dir, '.' + req.url);
        let ext = path.extname(p);
        if (!ext) {
          p += '.html';
          ext = 'html';
        }
        try {
          if (p.indexOf('..') !== -1) {
            throw new Error('Invalid path');
          }
          const data = fs.readFileSync(p);
          const mime = mimetypes[ext] || 'text/plain';
          res.writeHead(200, { 'Content-type': `${mime}; charset=utf-8` });
          res.end(data);
        } catch (e) {
          console.log(e);
          res.writeHead(404, { 'Content-type': 'text/plain' });
          res.end('Not found');
        }
      }
    } else {
      res.statusCode = 200;
      res.end();
    }
  }).listen(port, () => {
    console.log(`Dev server listening on port ${port}`);
  });
};

module.exports = ADOM;

