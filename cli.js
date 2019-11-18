#! /usr/bin/env node

let Adom = require('./index')
let fs = require('fs')
let path = require('path')
let config = {}
let dir = process.cwd()
let c = new Adom({ root: dir })

for (let i = 0; i < process.argv.length; i++) {
  switch (process.argv[i]) {
    case '-i':
      config.file = process.argv[i+1]
      break
    case '-o':
      config.out = process.argv[i+1]
      break
  }
}

if (!config.file || !config.out) {
  console.log('usage: -i <input> -o <output>')
} else {
  fs.writeFileSync(path.resolve(dir, config.out), c.compile_file(config.file, {}))
}
