const adom = require('./index')
const fs = require('fs')
const http = require('http')

const compiler = new adom({ cache: false })

function render (file, data) {
  return compiler.compile_file(file, data)
}

http.createServer(function (req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(render('test.adom', { items: [
    'walk dog',
    'buy cat',
    'walk cat'
  ] }))
}).listen(8000, function () { console.log('Listening on port:8000...') })

