# templates

A templating engine for Javascript. HTML is just awful to write. This is better.
#### Features
- Fast, single pass compiler
- Lean codebase with no dependencies
- Simple, single function API - string input, string output
- Elegant syntax but without whitespace sensitivity
- Can be used in any javascript environment
- basic control structures like if and each

Here is the smallest complete example:

```javascript
const Compile = require('./index')

let test = `
html [
  body [
    h1 | Hello, #{value}! |
  ]
]
`

let html = Compile(test, {
  value: 'world'
})

console.log(html)
```
