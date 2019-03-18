# a.dom

Advanced Data Oriented Markup

```javascript
const adom = require('adom')

let test = `
html [
  body [
    h1 | Hello, #{value}! |
  ]
]
`

let html = adom.compileString(test, {
  value: 'world'
})

console.log(html)
```