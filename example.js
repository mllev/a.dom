const adom = require('./index')

let example = `
doctype html5

layout Page title [
  html [
    head [ title | #{title} | ]
    body [
      yield
    ]
  ]
]

block Button text href [
  a href='#{href}' [
    if text == 'login' {
      button.btn-large | #{text} |
    } else {
      button.btn-small | #{text} |
    }
  ]
]

const buttonData:json '
  [
    { "text": "login", "href": "/login" },
    { "text": "register", "href": "/register" }
  ]
'

use Page '#{pageTitle}' [
  div [
    div | PAGE HEADER |
    div | PAGE BODY |
    each button in buttonData {
      [ Button button.text button.href ]
    }
  ]
]

use Page 'PAGE 2' [
  div [
    div | PAGE HEADER 2 |
    div | PAGE BODY 2 |
    each button in buttonData {
      [ Button button.text button.href ]
    }
  ]
]

use Page 'PAGE 3' [
  div [
    div | PAGE HEADER 3 |
    div | PAGE BODY 3 |
    each button in buttonData {
      [ Button button.text button.href ]
    }
  ]
]
`

html = adom.render(example, {
  data: {
    pageTitle: 'PAGE 1'
  },
  formatted: true
})

console.log(html)
