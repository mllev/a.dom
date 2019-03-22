# a.dom

Advanced Data Oriented Markup

ADOM is a language that compiles to HTML, has a terse syntax and a strong focus on data. Here's a live [playground](https://mllev.github.io/a.dom/). It was built with ADOM, and the source can be found in this repo. The `build.js` file is how the site is compiled.

```
npm install adom-js
```

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

This makes for a very terse form:
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

Data can be imported from a file:
```
const pageTitle file 'data.txt'

html [
  head [
    title | #{pageTitle} |
    meta name='description' content='page description';
  ]
]
```

The root directory for opening files is passed in as configuration:
```javascript
const htmlString = adom.render(adomString, { dirname: '/path/to/files' })
````

Data can be run through filters. Filters are simple functions (provided by you) that take the data as input, and return whatever you want as output. There is 1 included filter in ADOM called `json`. You can probably imagine what it does:
```
const pageData:json ' { "title" : "Page Title" } '

html [
  head [
    title | #{pageData.title} |
    meta name='description' content='page description';
  ]
]
```

As I said before, data can be included from any file. Data from a file is imported purely as text. Applying filters to data that comes from files looks like this:
```
const pageData file:json 'data.json'

html [
  head [
    title | #{pageData.title} |
    meta name='description' content='page description';
  ]
]
```

This allows for quite simple integration with other sorts of text processors:
```
const blogTitle 'My Blog'
const blogPost file:markdown 'post.md'
const blogStyles file:stylus 'blog.styl'

html [
  head [
    title | #{blogTitle} |
    meta name='description' content='page description';
    style | #{blogStyles} |
  ]
  body [
    div | #{blogPost} |
  ]
]
```

Passing in your own filters is quite easy. Here's how you would integrate with marked and stylus:
```javascript
const adom = require('adom-js')
const marked = require('marked')
const stylus = require('stylus')

const htmlString = adom.render(adomString, {
  dirname: '/path/to/files',
  filters: {
    markdown: function (str) {
      // from the marked api
      return marked(str)
    },
    stylus: function (str) {
      // from the stylus api
      return stylus(str).set().render()
    }
  }
})
```

ADOM supports conditionals and loops:
```
const images file:json 'cat-images.json'

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
ADOM supports code splitting via the `run` keyword. It will execute a separate ADOM file exactly where you `run` it:
```
html [
  head [
    title | Page Title |
  ]
  body [
    div | Page Body |
    run 'blog-footer.adom'
  ]
]
```

I'd suggest mixing `blocks` (and `layouts`) with the `run` keyword so components can be shared easily between files:
```
block Header [
  div [
    h1 | Page Header |
  ]
]

block Footer [
  div [
    h1 | Page Footer |
  ]
]
```

Assume the above is `components.adom`, and below is `index.adom`:
```
run 'components.adom'

html [
  head [
    title | Page Title |
  ]
  body [
    [ Header ]
    div | Page Body |
    [ Footer ]
  ]
]
```

ADOM should be seen as completely separate from its host environment, and should be defined entirely by its specification. This stipulation allows for two important things:

- ADOM can be implemented in any language
- Code written in ADOM can run without modification on any implementation

That being said, data can be passed in from the host environment:
```javascript
const adom = require('adom-js')

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

Data can be rich and deeply nested:
```javascript
const adom = require('adom-js')

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
