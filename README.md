# a.dom

Advanced Data Oriented Markup

ADOM is a language that compiles to HTML, has a terse syntax and a strong focus on data.

This is what tags looks like:
```
html [
  head [ ]
  body [ ]
]
```

This would of course compile to:
```html
<html>
  <head></head>
  <body></body>
</html>
```

ADOM has no whitespace sensitivity. The following is equally valid:
```
html[head[]body[]]
```

Text nodes are denoted using pipes:
```
html [
  head [
    title [
      | Page Title |
    ]
  ]
]
```

If a text node is the only child, the brackets may be omitted:
```
html [
  head [
    title | Page Title |
  ]
]
```

Tag attributes are the same as in html:
```
a href='/' target='_blank' | click me |
```

Void tags (meta, input, img, etc) are ended with semicolons:
```
html [
  head [
    title | Page Title |
    meta name='description' content='page description';
  ]
]
```

This makes for a very terse form syntax:
```
form action='/login' method='POST' [
  input name='username' type='text;
  input name='password' type='password';
  input type='submit' value='submit';
]
```

Data is a first class citizen of ADOM:
```
const pageTitle 'Page Title'

html [
  head [
    title | #{pageTitle} |
    meta name='description' content='page description';
  ]
]
```

Data can be passed in from the host environment:
```javascript
const adom = require('adom')

const adomString = `
  body [
    h1 | #{message} |
  ]
`

const html = adom.render(adomString, {
  data: { message: 'Hello from ADOM!' }
})

console.log(html)
```

Data can also be rich:
```javascript
const adom = require('adom')

const adomString = `
  body [
    h1 | #{messages[0].text} |
  ]
`

const html = adom.render(adomString, {
  data: { messages: [
    {
      text: 'Hello from ADOM!'
    }
  ]}
})

console.log(html)
```

ADOM supports conditionals and loops:
```javascript
const adom = require('adom')

const adomString = `
  html [
    head []
    body [
      h2 | CATS |
      if images != null {
        each image in images {
          img src='#{image}';
        }
      } else {
        p | no images |
      }
    ]
  ]
`

const html = adom.render(adomString, {
  data: { images: [
    'cat1.png',
    'cat2.png'
  ]}
})

console.log(html)
```

ADOM supports code reuse via something called `blocks`. They are analogous to functions:
```
block MyButton [
  a href='/register' [
    button.button-styles | Register |
  ]
]

p [
  [ MyButton ]
]

```

Blocks can take arguments:
```
block MyButton text link [
  a href='#{link}' [
    button.button-styles | #{text} |
  ]
]

p [
  [ MyButton 'Register' '/register' ]
  [ MyButton 'Login' '/login' ]
]
```

ADOM also supports code reuse via `layouts`:
```
layout PageBody [
  html [
    head [ ]
    body [
      yield
    ]
  ]
]

use PageBody [
  div [
    p | page content |
  ]
]
```
The `use` keyword is used to select a layout, and the `yield` keyword is used to position the child elements in the layout. The above example would compile to:
```html
<html>
  <head></head>
  <body>
    <div>
      <p>page content</p>
    </div>
  </body>
</htm>
```
Layouts can also take arguments:
```
layout PageBody title [
  html [
    head [
      title | #{title}
    ]
    body [
      yield
    ]
  ]
]

use PageBody 'Page Title' [
  div [
    p | page content |
  ]
]
```