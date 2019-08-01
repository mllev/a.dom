const adom = require('./index')
const fs = require('fs')
const http = require('http')

function render (file, data) {
  return adom(fs.readFileSync(file).toString(), data)
}

const pages = [
  '/page1',
  '/page2'
]

http.createServer(function (req, res) {
  if (pages.indexOf(req.url) !== -1) {
    const html = render('test.adom', { page: req.url })

    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(html)
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('not found')
  }
}).listen(8000, function () { console.log('Listening on port:8000...') })

