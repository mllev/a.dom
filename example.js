const adom = require('./index')
const fs = require('fs')

const example = fs.readFileSync('test.adom').toString()

html = adom(example, {
  items: []
})

console.log(html)

fs.writeFileSync('test.html', html)

