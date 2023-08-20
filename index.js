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
const http = require('http');
const https = require('https');
const esbuild = require('esbuild');
const core = require('./core.js');
const mimedb = require('./mime.json');
const getMatches = require('./match.js');

const ADOM = {};
const mimetypes = {};
const ssrCache = {};

const getPathInfo = (p, base) => {
  const full = base ? path.resolve(base, p) : path.resolve(process.cwd(), p);
  const parent = path.dirname(full);
  const file = path.basename(full);
  return { full, parent, file };
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
        html = adom.renderToHTML(ssrCache[cachePath], opts.data, opts.flush);
      /*
      } else if (fs.existsSync(cachePath)) {
        const cache = fs.readFileSync(cachePath, 'utf-8');
        html = await adom.renderToHTML(cache, opts.data);
      */
      } else {
        const cache = await adom.renderToCache(opts.input, opts.actions);
        // fs.writeFileSync(cachePath, cache);
        ssrCache[cachePath] = cache;
        html = adom.renderToHTML(cache, opts.data, opts.flush);
      }
    } else {
      html = await adom.render(opts.input, opts.data, opts.flush, opts.actions);
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
    } else {
      console.log(e);
      msg = `<pre>${e.message}</pre>`;
    }
    if (!opts.output) return msg;
    else {
      fs.writeFileSync(opts.output, msg);
    }
  }
};

const serveStaticFile = (p, res) => {
  let ext = path.extname(p);
  if (!ext)
    return false;
  ext = ext.slice(1);
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
  const stream = opts.stream || false;
  const actions = Object.keys(opts.actions || {});
  let routes = [];

  Object.keys(mimedb).forEach((type) => {
    if (mimedb[type].extensions) {
      mimedb[type].extensions.forEach((ext) => {
        mimetypes[ext] = type;
      });
    }
  });

  if (opts.routes) {
    if (opts.routes['*']) {
      routes = [opts.routes['*']];
      routes[0].path = '*';
    } else {
      routes = Object.keys(opts.routes).map((route) => {
        return {
          path: route,
          input: opts.routes[route].input || opts.routes[route].path,
          data: opts.routes[route].data,
          handler: opts.routes[route].handler
        };
      });
    }
  }

  function handleAction (req, res) {
    if (req.method === 'POST') {
      if (req.body.type === 'ADOM_SERVER_FUNCTION') {
        const name = req.body.name;
        const args = req.body.args;
        if (opts.actions[name]) {
          opts.actions[name].apply(undefined, args).then((data) => {
            res.writeHead(200, { 'Content-type': 'application/json; charset=utf-8' });
            if (!data) data = null;
            res.end(JSON.stringify(data));
          }).catch((e) => {
            console.error(e);
            res.writeHead(500, { 'Content-type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ message: `Server error when calling ${name}` }));
          });
        } else {
          res.writeHead(500, { 'Content-type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ message: `${name} is not defined on the server` }));
        }
        return true;
      }
    }
    return false;
  }

  async function app (req, res) {
    const p = url.parse(req.url).pathname;
    req.query = parseQuery(req.url);
    if (req.method === 'POST' || req.method === 'PUT') {
      req.body = await parseBody(req, 1e9);
    } else {
      req.body = {};
    }
    if (handleAction(req, res)) {
      return;
    }
    if (req.method === 'GET') {
      let f = path.resolve(process.cwd(), publicDir, p.slice(1));
      const ext = path.extname(f);
      if (ext && serveStaticFile(f, res)) return;
    }
    let r = 0;
    async function next() {
      for (; r < routes.length; r++) {
        let data = {};
        const params = getMatches(p, routes[r].path);
        if (!params) continue;
        req.params = params;
        if (routes[r].data) {
          if (typeof routes[r].data === 'object') {
            data = routes[r].data;
          } else if (typeof routes[r].data === 'function') {
            data = await routes[r].data(req);
            if (!data) continue;
          } else {
            throw new Error("config error: 'data' property must be an object or function");
          }
        }
        if (routes[r].handler &&
          (!routes[r].method || routes[r].method.toUpperCase() === req.method)) {
          routes[r++].handler(req, res, next);
        } else if (routes[r].input) {
          if (req.params && !data.params) {
            data.params = req.params;
          }
          if (stream) {
            res.writeHead(200, {'Content-type': 'text/html; charset=utf-8' });
            await ADOM.compile(routes[r].input, {
              flush: res.write.bind(res),
              data,
              minify,
              cache,
              actions
            });
            res.end();
          } else {
            const html = await ADOM.compile(routes[r].input, {
              data,
              minify,
              cache,
              actions
            });
            res.writeHead(200, {'Content-type': 'text/html; charset=utf-8' });
            res.end(html);
          }
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
      if (req.method === 'GET') {
        let f = path.resolve(process.cwd(), publicDir, p.slice(1) || 'index');
        const ext = path.extname(f);
        if (!ext) {
          f += '.html';
          if (serveStaticFile(f, res)) return;
        }
      }
      res.writeHead(404, { 'Content-type': 'text/plain' });
      res.end('not found');
    }
    next();
  }

  app.route = (path, opts, method) => {
    let handler = null;

    if (typeof path !== 'string')
      throw new Error('app.route expects a string as a first argument')
    if (!opts)
      throw new Error('app.route expects a second argument');
    if (typeof opts === 'string') {
      opts = { input: opts };
    } else if (typeof opts === 'function') {
      handler = opts;
    }

    routes.push({
      path,
      method: method || opts.method,
      input: opts.input,
      data: opts.data,
      handler: handler || opts.handler
    });

    return app;
  };

  app.get = (path, opts) => {
    return app.route(path, opts || {}, 'get');
  };

  app.post = (path, opts) => {
    return app.route(path, opts || {}, 'post');
  };

  app.put = (path, opts) => {
    return app.route(path, opts || {}, 'put');
  };

  app.delete = (path, opts) => {
    return app.route(path, opts || {}, 'delete');
  };

  return app;
};

ADOM.serve = (opts) => {
  const port = opts.port || 3838;
  const app = ADOM.app(opts);
  http.createServer(app).listen(port, () => {
    console.log(`Listening on port ${port}...`);
  })
};

module.exports = ADOM;

