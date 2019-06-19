const adom = require('./index')
const fs = require('fs')

const example = fs.readFileSync('test.adom').toString()

html = adom(example, {
  count: 0
})

fs.writeFileSync('test.html', html)

