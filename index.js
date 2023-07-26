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
const ssrCache = {};

const getPathInfo = (p, base) => {
  const full = base ? path.resolve(base, p) : path.resolve(process.cwd(), p);
  const parent = path.dirname(full);
  const file = path.basename(full);
  return { full, parent, file };
};

const getMatches = (istr, mstr) => {
  if (mstr === '*') return {};
  const p0 = istr.split('/').filter(p => p);
  const p1 = mstr.split('/').filter(p => p);
  const out = {};
  if (p0.length > p1.length && p1.length > 0) {
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

const addParentPaths = (code, p) => {
  const len = code.length;
  let out = '';
  for (let i = 0; i < len; i++) {
    if (code.slice(i, i+10) === 'require(".') {
      let f = '';
      i += 9;
      while (code[i] !== '"') f += code[i++];
      out += `require("${path.resolve(p, f)}"`;
    } else {
      out += code[i];
    }
  }
  return out;
};

const esbuild_to_adom_error = (e, chunk) => {
  let row = e.location.line - 1;
  let col = e.location.column;
  let pos;

  for (pos = 0; pos < chunk.code.length; pos++) {
    if (chunk.code[pos] === '\n') row--;
    if (row == 0) {
      if (col > 0) col--;
      else break;
    }
  }

  return {
    origin: 'adom',
    msg: e.text,
    pos: chunk.pos + 3 + pos + 1,
    file: chunk.file
  };
};

ADOM.compile = async (name, opts) => {
  if (name && typeof name === 'object') {
    opts = name;
  }
  if (!opts) opts = {};
  if (typeof name === 'string') {
    opts.input = name;
  }
  const pathInfo = getPathInfo(opts.input);
  const parentDir = pathInfo.parent;
  const adom = core({
    jsTransform: async (chunk) => {
      try {
        const opts = { format: 'cjs', loader: 'ts' };
        const result = await esbuild.transform(chunk.code, opts);
        return addParentPaths(result.code, chunk.parent_dir);
      } catch (e) {
        e.origin = 'esbuild';
        e.chunk = chunk;
        throw e;
      }
    },
    jsPostProcess: async (js) => {
      const result = await esbuild.build({
        stdin: {
          contents: js,
          resolveDir: parentDir
        },
        bundle: true,
        minify: opts.minify,
        write: false
      });
      return result.outputFiles[0].text;
    }
  });
  try {
    let html;
    if (opts.cache) {
      const cacheDir = opts.cacheDir || parentDir;
      const cachePath = path.resolve(cacheDir, pathInfo.file + '.json');
      if (ssrCache[cachePath]) {
        html = await adom.renderToHTML(ssrCache[cachePath], opts.data);
      /*
      } else if (fs.existsSync(cachePath)) {
        const cache = fs.readFileSync(cachePath, 'utf-8');
        html = await adom.renderToHTML(cache, opts.data);
      */
      } else {
        const cache = await adom.renderToCache(opts.input, opts.data);
        // fs.writeFileSync(cachePath, cache);
        ssrCache[cachePath] = cache;
        html = await adom.renderToHTML(cache, opts.data);
      }
    } else {
      html = await adom.render(opts.input, opts.data);
    }
    if (!opts.output) {
      return html;
    } else {
      fs.writeFileSync(opts.output, html);
    }
  } catch (e) {
    let msg;
    if (e.origin === 'esbuild') {
      if (e.chunk) {
        e = esbuild_to_adom_error(e.errors[0], e.chunk);
      }
    }
    if (e.origin === 'adom') {
      msg = `<pre>${adom.printError(e)}</pre>`;
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
    if (p.indexOf('..') !== -1) {
      res.statusCode = 403;
      res.end();
      return true;
    }
    const data = fs.readFileSync(p);
    const mime = mimetypes[ext] || 'text/plain';
    res.writeHead(200, { 'Content-type': `${mime}` });
    res.end(data);
    return true;
  } catch (e) {
    return false;
  }
};

const parseBody = (req, max) => {
  return new Promise((resolve, reject) => {
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
    req.on('error', (e) => {
      reject(e);
    });
  });
};

const parseQuery = (p) => {
  const purl = url.parse(p);
  if (purl.query) {
    return qs.parse(purl.query);
  }
  return {};
};

ADOM.request = (opts) => {
  const http = require('http');
  const https = require('https');

  if (typeof opts === 'string') {
    opts = {
      method: 'GET',
      url: opts
    };
  }

  const get = (opts, fn) => {
    const proto = opts.url.indexOf('https') === 0 ? https : http;
    proto.get(opts.url, async (res) => {
      try {
        const data = await parseBody(res, 1e9);
        fn(null, data);
      } catch (e) {
        fn(e);
      }
    });
  };

  const post = (opts, fn) => {
    const proto = opts.port === 443 ? https : http;
    const data = opts.data;

    opts.data = undefined;
    opts.method = opts.method.toUpperCase() || 'POST';

    const request = proto.request(opts, async (res) => {
      try {
        const data = await parseBody(res, 1e9);
        fn(null, data);
      } catch (e) {
        fn(e);
      }
    });

    request.on('error', fn);
    request.write(data);
    request.end();
  };

  return new Promise((resolve, reject) => {
    let func = post;
    if (opts.method.toLowerCase() === 'get') {
      func = get;
    }
    func(opts, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
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
    const p = url.parse(req.url).pathname;
    if (req.method === 'GET') {
      const f = path.resolve(process.cwd(), publicDir, p.slice(1));
      if (serveStaticFile(f, res)) return;
    }
    if (routes['*']) {
      routes = { '*': routes['*'] };
    }
    for (let r in routes) {
      let data;
      const params = getMatches(p, r);
      if (!params) continue;
      if (routes[r].data) {
        if (typeof routes[r].data === 'object') {
          data = routes[r].data;
        } else {
          req.params = params;
          req.query = parseQuery(req.url);
          if (req.method === 'POST' || req.method === 'PUT') {
            req.body = await parseBody(req, 1e9);
          } else {
            req.body = {};
          }
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
      } else {
        res.statusCode = 200;
        res.end();
      }
      return;
    }
    res.writeHead(404, { 'Content-type': 'text/plain' });
    res.end('not found');
  };
};

module.exports = ADOM;

