const adom = require('./index')
const fs = require('fs')

const example = fs.readFileSync('test.adom').toString()

html = adom(example, {
  count: 0,
  people: ['mark', 'mike', 'jon'],
  cats: ['tortoise shell', 'persian']
})

console.log(html)

fs.writeFileSync('test.html', html)

