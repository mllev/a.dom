const Compile = require('./index')

let test = `
html [
  body [
    h1 | Hello, my name is {name} |
  ]
]
`

let html = Compile(test, {
  name: 'Matthew'
})

console.log(html)