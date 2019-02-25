const Compile = require('./index')

let test = `
html [
  body [
    h1 | {value1}, {value2}! |
  ]
]
`

let html = Compile(test, {
  value1: 'Hello',
  value2: 'world'
})

console.log(html)