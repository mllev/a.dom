const Adom = require('./index')
const fs = require('fs')
const http = require('http')

const compiler = new Adom({ cache: false })

console.log(compiler.compile_file('example.adom', {}))
