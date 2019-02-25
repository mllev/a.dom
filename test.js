const Compile = require('./index')

let test = `
html [
  body [
    h1 | Hello, {value}! |
  ]
]
`

let html = Compile(test, {
  value: 'world'
})

console.log(html)