#! /usr/bin/env node

const fs = require('fs');
const path = require('path');
const adom = require('./index.js');
const dir = process.cwd();
const config = {};

const help = `
usage: adom [options]
  options:
    create <name>    Create a project boilerplate using A-DOM's built-in router
      --lean         Create a very minimal boilerplate using A-DOM's built-in router
      --express      Create a project boilerplate using express

    dev              Start a dev server
    -r <path>=<file> Specify a route to an adom file for the dev server
    -p <port>        Port for the dev server (defaults to 3838)
    -d <dir>         Public directory for the dev server
`;

const expressServerFile = `const path = require('path');
const http = require('http');
const express = require('express');
const adom = require('adom-js');

const prod = !process.argv.includes('dev');

const config = {
  cache: prod,
  minfiy: prod
};

const port = 3838;

const content = {
  page1: 'Welcome to page 1',
  page2: 'Welcome to page 2'
};

const app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.route('/', 'src/index.adom');

app.get('/', async (req, res) => {
  const html = await adom.compile('src/index.adom', config);
  res.setHeader('Content-type', 'text/html');
  res.end(html)
});

app.get('/:page_id', async (req, res) => {
  const html = await adom.compile('src/page.adom', {
    data: {
      content: content[req.params.page_id]
    },
    ...config
  });
  res.setHeader('Content-type', 'text/html');
  res.end(html);
});

http.createServer(app).listen(port, () => {
  console.log(\`Listening on port \${port}\`);
});
`;

const serverFile = `const http = require('http');
const adom = require('adom-js');

const prod = !process.argv.includes('dev');

const port = 3838;

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
  console.log(\`Listening on port \${port}\`);
});
`;

const packageFile = (name, version, express) => `{
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
    "adom-js": "^${version}"${express ? `,
    "express": "*"` : ''}
  }
}
`;

const layoutFile = `export tag Layout [
  html lang='en' [
    head [
      title 'A-DOM'
      meta charset='UTF-8' []
      meta name='viewport' content='width=device-width, initial-scale=1.0' []
      meta name='description' content='my site' []
      link rel='stylesheet' href='main.css' []
    ]
    body [
      yield
    ]
  ]
]
`;

const pageFile = `import 'layout.adom'

Layout [
  main [
    a href='/' 'home'
    p '{{data.content}}'
  ]
]
`;

const indexFile = `import 'layout.adom'

tag Counter [
  let count = 0
  button on:click='count++' 'count: {{count}}'
]

tag Nav [
  div [
    a href='/page1' 'page 1'
    a href='/page2' 'page 2'
  ]
]

Layout [
  main [
    Nav []
    Counter []
  ]
]
`;

const todoFile = `export tag TodoList [
  let item = ''
  let items = props.items
  ---
  const add = () => {
    items.push(item);
    item = '';
  };
  ---
  input bind:value={item} []
  button on:click='add()' 'add'
  ul [
    each (i in items) [
      li '{{i}}'
    ]
  ]
]
`

const quickIndex = `import './todo.adom'

tag Counter [
  let count = 0
  button on:click='count++' 'count: {{count}}'
]

html [
  head [
    title 'A-DOM'
    meta charset='UTF-8' []
    meta name='viewport' content='width=device-width, initial-scale=1.0' []
    meta name='description' content='my site' []
    link rel='stylesheet' href='main.css' []
  ]
  body [
    h1 'Welcome'
    Counter []
    br []
    TodoList items={data.items} []
  ]
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
      path: 'index.adom',
      data: {
        items: [
          'wake up',
          'walk dog'
        ]
      }
    }
  }
});
`;

const cssFile = `body {
  font-family: "Helvetica Neue", Arial, sans-serif;
  margin: 20px;
}
`

for (let i = 0; i < process.argv.length; i++) {
  switch (process.argv[i]) {
    case 'create':
      config.create = process.argv[++i];
      break
    case '--lean':
      config.lean = true;
      break
    case '--express':
      config.express = true;
      break
    case 'dev':
      config.dev = true;
      break;
    case '-d':
      config.publicDir = process.argv[++i];
      break;
    case '-p':
      config.port= process.argv[++i];
      break;
    case '-r':
      const r = process.argv[++i];
      if (r) {
        const parts = r.split('=');
        if (parts.length === 2) {
          if (!config.routes) config.routes = {};
          config.routes[parts[0]] = { input: parts[1] };
        }
      }
      break;
    default:
      break
  }
}
if (config.dev) {
  adom.serve({
    port: config.port || 3838,
    publicDir: config.publicDir || '.',
    routes: config.routes
  });
} else if (config.create) {
  const p = path.resolve(dir, config.create);
  const pf = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));
  fs.mkdirSync(p);
  if (config.lean) {
    fs.mkdirSync(path.join(p, 'public'));
    fs.writeFileSync(path.join(p, 'public/main.css'), cssFile);
    fs.writeFileSync(path.join(p, 'index.adom'), quickIndex);
    fs.writeFileSync(path.join(p, 'todo.adom'), todoFile);
    fs.writeFileSync(path.join(p, 'server.js'), quickServer);
    fs.writeFileSync(path.join(p, 'package.json'), packageFile(config.create, pf.version));
  } else {
    fs.mkdirSync(path.join(p, 'public'));
    fs.mkdirSync(path.join(p, 'src'));
    fs.writeFileSync(path.join(p, 'public/main.css'), cssFile);
    fs.writeFileSync(path.join(p, 'src/index.adom'), indexFile);
    fs.writeFileSync(path.join(p, 'src/page.adom'), pageFile);
    fs.writeFileSync(path.join(p, 'src/layout.adom'), layoutFile);
    fs.writeFileSync(path.join(p, 'server.js'), config.express ? expressServerFile : serverFile);
    fs.writeFileSync(path.join(p, 'package.json'), packageFile(config.create, pf.version, config.express));
  }
} else {
  console.log(help);
}
