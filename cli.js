#! /usr/bin/env node

let Adom = require('./index')
let fs = require('fs')
let path = require('path')
let config = {}
let dir = process.cwd()

for (let i = 0; i < process.argv.length; i++) {
  switch (process.argv[i]) {
    case '-i':
      config.file = process.argv[i+1]
      break
    case '-o':
      config.out = process.argv[i+1]
      break
    case '-r':
      config.root = process.argv[i+1]
      break
    case '-p':
      config.devPort = process.argv[i+1]
    case '--dev':
      config.dev = true
      break
  }
}

let c = new Adom({ rootDir: path.resolve(dir, config.root || '') })

if (!config.dev) {
  if (!config.file || !config.out) {
    console.log('usage: -i <input> -o <output> -r <root src directory>')
  } else {
    fs.writeFileSync(path.resolve(dir, config.out), c.render(config.file))
  }
} else {
  let port = config.devPort || 5000
  require('http').createServer(function (req, res) {
    res.writeHead(200, { 'Content-type': 'text/html' })
    res.end(c.render(config.file))
  }).listen(port, function () {
    console.log('development server running on port: ' + port)
  })
}
