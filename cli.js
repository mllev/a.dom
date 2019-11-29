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
  }
}

let c = new Adom({ rootDir: path.resolve(dir, config.root || '') })

if (!config.file || !config.out) {
  console.log('usage: -i <input> -o <output> -r <root src directory>')
} else {
  fs.writeFileSync(path.resolve(dir, config.out), c.render(config.file))
}
