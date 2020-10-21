#! /usr/bin/env node

let Adom = require('./index')
let fs = require('fs')
let path = require('path')
let config = {}
let dir = process.cwd()
let routes = {};
let help = `
usage: adom [options]
  options:
    <input>     input file name
    -o <output> output file name
    -f          force write if the output file already exists
                example: adom index.adom -o index.html -f

    --dev       start a development server that statically serves the current directory
    -p <port>   development server port - defaults to 5000
    -r <route>  a route so the development server knows how to map adom files to urls
                example: adom --dev -r /=index.adom -r /home=home.adom -p 8080

    -d <dir>    directory location of adom files - omit if in current directory
                example: adom -d src index.adom -o index.html -f

    --new <app> generates a tiny starter project
`

for (let i = 0; i < process.argv.length; i++) {
  switch (process.argv[i]) {
    case '-o':
      config.out = process.argv[++i]
      break
    case '-f':
      config.forceWrite = true;
      break
    case '-d':
      config.root = process.argv[++i]
      break
    case '-p':
      config.devPort = process.argv[++i]
      break
    case '-r':
      let route = process.argv[++i];
      let parts = route.split('=');
      if (parts.length === 2) {
        routes[parts[0]] = parts[1];
      }
      break
    case '--dev':
      config.dev = true;
      break
    case '--new':
      config.starter = true;
      config.app = process.argv[++i];
      break
    default:
      config.file = process.argv[i];
      break
  }
}

let mimeTypes = {
  html: 'text/html',
  ico: 'image/vnd.microsoft.icon',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  js: 'text/javascript',
  json: 'application/json',
  jsonld: 'application/ld+json',
  png: 'image/png',
  mjs: 'text/javascript',
  mp3: 'audio/mpeg',
  mpeg:  'video/mpeg',
  ico: 'image/vnd.microsoft.icon',
  gz: 'application/gzip',
  gif: 'image/gif',
  rar: 'application/vnd.rar',
  rtf: 'application/rtf',
  svg: 'image/svg+xml',
  tar: 'application/x-tar',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  ttf: 'TrueType Font  font/ttf',
  txt: 'text/plain',
  vsd: 'application/vnd.visio',
  wav: 'audio/wav',
  weba: 'audio/webm',
  webm: 'video/webm',
  webp: 'image/webp',
  woff: 'font/woff',
  woff2: 'font/woff2',
  xhtml: 'application/xhtml+xml',
  xls: 'application/vnd.ms-excel',
  xlsx:  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xml: 'text/xml',
  zip: 'application/zip'
};

let c = new Adom({ root: path.resolve(dir, config.root || ''), cache: false });

if (config.starter) {
  if (!config.app) {
    console.log(help);
  } else {
    let package = `{
  "name": "${config.app}",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "dev": "npx adom-js --dev -r /=index.adom"
  },
  "author": "",
  "license": "ISC"
} 
`;
    let starter = `html lang='en' [
  head []
  body [
    h1 "Hello from ADOM"
  ]
]
`;
    if (!fs.existsSync(config.app)) {
      fs.mkdirSync(config.app);
      fs.writeFileSync(path.resolve(dir, config.app,  'index.adom'), starter);
      fs.writeFileSync(path.resolve(dir, config.app, 'package.json'), package);
    } else {
      console.log(`Error: ${config.app} already exists`);
    }
  }
} else if (!config.dev) {
  if (!config.file || !config.out) {
    console.log(help);
  } else {
    let p = path.resolve(dir, config.out);
    if (fs.existsSync(p) && !config.forceWrite) {
      console.log('Error: file already exists:', p);
    } else {
      fs.writeFileSync(path.resolve(dir, config.out), c.render(config.file));
    }
  }
} else {
  let port = config.devPort || 5000
  require('http').createServer(function (req, res) {
    let url = req.url;
    console.log(req.method, url);
    if (routes[url]) {
      res.writeHead(200, { 'Content-type': 'text/html; charset=utf-8' });
      res.end(c.render(routes[url]));
      return;
    } else {
      try {
        let file = url[0] === '/' ? url.slice(1) : url;
        let parts = file.split('.');
        let ext = parts[parts.length - 1];
        let mime = mimeTypes[ext] || 'text/plain';
        let data = fs.readFileSync(file);
        res.writeHead(200, { 'Content-type': `${mime}; charset=utf-8` });
        res.end(data);
      } catch (e) {
        res.writeHead(404, { 'Content-type': 'text/html; charset=utf-8' });
        res.end('<p>Not found.</p>');
      }
    }
  }).listen(port, function () {
    console.log('Development server running on port: ' + port);
  });
}
