#! /usr/bin/env node

let Adom = require('./index')
let fs = require('fs')
let c = new Adom({ root: __dirname })
let config = {}

for (let i = 0; i < process.argv.length; i++) {
  let opt
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
  fs.writeFileSync(config.out, c.compile_file(config.file, {}))
}
