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
const qs = require('querystring');
const url = require('url');
const esbuild = require('esbuild');
const core = require('./core.js');
const mimedb = require('./mime.json');

const ADOM = {};
const mimetypes = {};

const getPathInfo = (p, base) => {
  const full = base ? path.resolve(base, p) : path.resolve(process.cwd(), p);
  const parent = path.dirname(full);
  return {
    full,
    parent
  };
};

const getMatches = (istr, mstr) => {
  if (mstr === '*') return {};
  const p0 = istr.split('/').filter(p => p);
  const p1 = mstr.split('/').filter(p => p);
  const out = {};
  if (p0.length > p1.length) {
    const last = p1[p1.length - 1];
    if (last[last.length - 1] !== '*') {
      return null;
    }
  } else if (p0.length !== p1.length) return null;
  for (let i = 0; i < p1.length; i++) {
    const p = p1[i];
    if (p[0] !== ':') {
      if(p !== p0[i]) return null;
      // else keep moving
    } else {
      if (i === p1.length - 1 && p[p.length - 1] === '*') {
        out[p.slice(1, -1)] = p0[i];
        for (let j = i + 1; j < p0.length; j++) {
          out[p.slice(1, -1)] += `/${p0[j]}`;
        }
      } else {
        out[p.slice(1)] = p0[i];
      }
    }
  }
  return out;
};

const processJs = async (js, config) => {
  const addParentPaths = (code, par) => {
    const len = code.length;
    let out = '';
    for (let i = 0; i < len; i++) {
      if (code.slice(i, i+10) === 'require(".') {
        let f = '';
        i += 9;
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
        return addParentPaths(result.code, chunk.parent_dir);
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

const serveStaticFile = (p, res) => {
  let ext = path.extname(p);
  if (!ext) {
    p += '.html';
    ext = 'html';
  } else {
    ext = ext.slice(1);
  }
  try {
    console.log(p, ext, mimetypes[ext]);
    if (p.indexOf('..') !== -1) {
      res.statusCode = 403;
      res.end();
      return true;
    }
    const data = fs.readFileSync(p, 'utf-8');
    const mime = mimetypes[ext] || 'text/plain';
    res.writeHead(200, { 'Content-type': `${mime}; charset=utf-8` });
    res.end(data);
    return true;
  } catch (e) {
    console.log(e)
    return false;
  }
};

const parseBody = (req, max) => {
  return new Promise((resolve, reject) => {
    if (req.method === 'POST' || req.method === 'PUT') {
      let buf = '';
      let data;
      req.on('data', (chunk) => {
        if (buf.length > max) {
          reject('Maximum body size exceeeded');
        } else {
          buf += chunk;
        }
      });
      req.on('end', () => {
        try {
          data = JSON.parse(buf);
        } catch (e) {
          try {
            data = qs.parse(buf);
          } catch (e) {
            reject('Invalid request body format');
          }
        }
        resolve(data);
      })
    } else {
      resolve(null);
    }
  });
};

const parseQuery = (p) => {
  const purl = url.parse(p);
  if (purl.query) {
    return qs.parse(purl.query);
  }
  return null;
};

ADOM.app = (opts) => {
  const publicDir = opts.publicDir || '.';
  const minify = opts.minify || false;
  const cache = opts.cache || false;
  let routes = opts.routes || {};

  Object.keys(mimedb).forEach((type) => {
    if (mimedb[type].extensions) {
      mimedb[type].extensions.forEach((ext) => {
        mimetypes[ext] = type;
      });
    }
  });

  return async (req, res) => {
    const p = req.url;
    let found = false;
    if (req.method === 'GET') {
      const f = path.resolve(process.cwd(), publicDir, p.slice(1));
      if (serveStaticFile(f, res)) {
        found = true;
      }
    }
    if (routes['*']) {
      routes = { '*': routes['*'] };
    }
    for (let r in routes) {
      const params = getMatches(p, r);
      if (params) {
        let data;
        if (routes[r].data) {
          if (typeof routes[r].data === 'object') {
            data = routes[r].data;
          } else {
            req.params = params;
            req.query = parseQuery(p);
            req.body = await parseBody(req)
            data = await routes[r].data(req);
          }
        }
        if (routes[r].path) {
          const html = await ADOM.compile(routes[r].path, { data, minify, cache });
          res.writeHead(200, {'Content-type': 'text/html; charset=utf-8' });
          res.end(html);
        } else if (data) {
          if (typeof data !== 'object') {
            throw new Error('Data function must return an object or array');
          }
          res.writeHead(200, {'Content-type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(data));
        }
        found = true;
        break;
      }
    }
    if (!found) {
      res.writeHead(404, { 'Content-type': 'text/plain' });
      res.end('Not found');
    }
  };
};

module.exports = ADOM;

