#! /usr/bin/env node

const fs = require('fs');
const path = require('path');
const adom = require('./index.js');
const dir = process.cwd();
const config = {};

const help = `
usage: adom [options]
  options:
    create <name>    Create a project boilerplate
    dev              Start a dev server
    -r <path>=<file> Specify a route to an adom file for the dev server
    -p <port>        Port for the dev server (defaults to 3838)
`;

const buildFile = `const http = require('http');
const adom = require('adom-js');

const prod = !process.argv.includes('dev');

const content = {
  page1: 'Welcome to page 1',
  page2: 'Welcome to page 2'
};

const app = adom.app({
  publicDir: './public',
  cache: prod,
  minify: prod
});

app.route('/', 'src/index.adom');

app.route('/:page_id', {
  input: 'src/page.adom',
  data: async (req) => {
    return { content: content[req.params.page_id] }
  }
});

http.createServer(app).listen(port, () => {
  console.log(\`Listening on port ${port}\`);
});
`;

const packageFile = (name, version) => `{
  "name": "${name}",
  "version": "0.0.1",
  "description": "",
  "main": "server.js",
  "scripts": {
    "prod": "node server",
    "dev": "node server dev"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "adom-js": "^${version}"
  }
}
`;

const layoutFile = `
export tag Layout [
  html lang='en' [
    head [
      title 'A-DOM'
      meta charset='UTF-8' []
      meta name='viewport' content='width=device-width, initial-scale=1.0' []
      meta name='description' content='my site' []
    ]
    body [
      yield
    ]
  ]
]
`;

const pageFile = `import 'layout.adom'

Layout [
  p '{{data.content}}'
  a href='/' 'home'
]
`;

const indexFile = `import 'layout.adom'

tag Counter [
  let count = 0
  button on:click='count++' 'count: {{count}}'
]

tag Nav [
  a href='/page1' 'page 1'
  a href='/page2' 'page 2'
]

Layout [
  Nav []
  Counter []
]
`;

const quickIndex = `tag Counter [
  let count = 0
  button on:click='count++' 'count: {{count}}'
]

html [
  head [
    title 'A-DOM'
  ]
  h1 'Welcome'
  Counter []
]
`;

const quickServer = `const adom = require('adom-js');

const prod = !process.argv.includes('dev');

adom.serve({
  publicDir: './public',
  cache: prod,
  minify: prod,
  routes: {
    '/': {
      path: 'index.adom'
    }
  }
});
`;

for (let i = 0; i < process.argv.length; i++) {
  switch (process.argv[i]) {
    case 'create':
      config.create = process.argv[++i];
      break
    case '--lean':
      config.lean= true;
      break
    case 'dev':
      config.dev = true;
      break;
    case '-p':
      config.publicDir = process.argv[++i];
      break;
    case '-r':
      const r = process.argv[++i];
      if (r) {
        const parts = r.split('=');
        if (parts.length === 2) {
          if (!config.routes) config.routes = {};
          config.routes[parts[0]] = { path: parts[1] };
        }
      }
      break;
    default:
      break
  }
}
if (config.dev) {
  adom.serve({
    publicDir: config.publicDir || '.',
    routes: config.routes
  });
} else if (config.create) {
  const p = path.resolve(dir, config.create);
  const pf = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));
  fs.mkdirSync(p);
  if (config.lean) {
    fs.writeFileSync(path.join(p, 'index.adom'), quickIndex);
    fs.writeFileSync(path.join(p, 'server.js'), quickServer);
    fs.writeFileSync(path.join(p, 'package.json'), packageFile(config.create, pf.version));
  } else {
    fs.mkdirSync(path.join(p, 'public'));
    fs.mkdirSync(path.join(p, 'src'));
    fs.writeFileSync(path.join(p, 'src/index.adom'), indexFile);
    fs.writeFileSync(path.join(p, 'src/page.adom'), pageFile);
    fs.writeFileSync(path.join(p, 'src/layout.adom'), layoutFile);
    fs.writeFileSync(path.join(p, 'server.js'), buildFile);
    fs.writeFileSync(path.join(p, 'package.json'), packageFile(config.create, pf.version));
  }
} else {
  console.log(help);
}
