const adom = require('./index')

let example = `
layout Page title [
  doctype html5
  
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
      button.btn-large | \\|#{text}\\| |
    } else {
      button.btn-small | #{text} |
    }
  ]
]

const testStr 'login'

const buttonData:json '
  [
    { "text": "#{testStr}", "href": "/login" },
    { "text": "register", "href": "/register" }
  ]
'

use [ Page '#{pageTitle}' ] [
  div [
    div | PAGE HEADER |
    div | PAGE BODY |
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
