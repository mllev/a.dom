const Adom = require('./index')
const fs = require('fs')
const http = require('http')

const compiler = new Adom({ cache: false })
compiler.compile_file('example.adom', {})
