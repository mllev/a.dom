const adom = require('./index')
const path = require('path')
const fs = require('fs')

const main = path.resolve(__dirname, 'www/main.adom')

html = adom.renderFile(main, {
  dirname: path.resolve(__dirname, 'www')
})

fs.writeFileSync('index.html', html)
