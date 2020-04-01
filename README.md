<h1 align="center">
	<br>
    <img width="200" src="https://raw.githubusercontent.com/mllev/a.dom/master/logo.png">
    <br>
</h1>

## a.dom

Advanced Data Oriented Markup

ADOM is a revolutionary tool that combines the simplicity of the early web with the power of the modern web.

In less than 2k lines of code, with no dependencies whatsoever, ADOM includes:

- an extremely terse templating language with data declaration, control flow, custom tags, and no whitespace sensitivity
- a lightweight, high speed reactive UI engine exposed as a single API call to your Javascript
- server side rendering that is simpler, faster, and *far* easier to understand than all modern solutions
- flexible code separation and project structure

#### STARTING POINT
The only thing you need to understand before continuing is how an HTML document is constructed. If you're comfortable creating a basic application in a single HTML file using `<script>` tags and `<style>` tags, you're ready to begin learning ADOM.

#### CONCEPTS
ADOM fits safely into the following two categories: compiler-based reactive framework and server-rendered templating engine. This allows for an extreme simplification of the modern web development environment. ADOM makes large dependencies like Babel and Webpack optional rather than absolute requirements for a decent development experience.

#### TRY ONLINE
An online playground can be found [here](https://mllev.github.io/a.dom-www/).

#### INSTALLATION AND USAGE
ADOM can be used as either a library or as a global compiler/development server. Both options are extremely simple. 

If you would like to use the built-in development server instead, use the following commands:
```
npm install -g adom-js
touch index.adom
adom --dev -r /=index.adom
```
Now you can edit `index.adom` without needing to restart the server. The rest of this guide will assume that you are using ADOM as a library, so all the features can be covered.

First, create a basic server.
```javascript
require('http').createServer(function (req, res) {
  res.writeHead(200, { 'Content-type': 'text/html; charset=utf-8' });
  res.end('<h1>Hey!</h1>');
}).listen(8000, function () {
  console.log('Listening on port 8000');
})
```
Then install ADOM.
```
npm install adom-js
```
Now create a basic ADOM file.
```javascript
html [
  head []
  body [
    h1 "Hello!"
  ]
]
```
Using ADOM is a simple as creating an instance of the compiler, and compiling your ADOM files on each request. This is ADOM's development configuration, as there is no need for server restarts.
```javascript
const Adom = require('adom-js');
const compiler = new Adom();

require('http').createServer(function (req, res) {
  res.writeHead(200, { 'Content-type': 'text/html; charset=utf-8' });
  res.end(compiler.render('index.adom');
}).listen(8000, function () {
  console.log('Listening on port 8000');
})
```
Unlike other templating engines, ADOM does not generate a javascript file. Production mode only requires that `cache` is set to `true`.
```javascript
const Adom = require('adom-js');
const compiler = new Adom({ cache: true });

require('http').createServer(function (req, res) {
  res.writeHead(200, { 'Content-type': 'text/html; charset=utf-8' });
  res.end(compiler.render('index.adom'));
}).listen(8000, function () {
  console.log('Listening on port 8000');
});
```
If `cache` is set to `false`, the entire ADOM source tree will be recompiled on each call to `render`. This allows for a smooth development experience that doesn't require additional tools to watch your files.

ADOM will search the current directory for 'index.adom', in the above example. You can specify a new directory with the `root` flag.
```javascript
const Adom = require('adom-js');
const compiler = new Adom({
  cache: true,
  root: 'src'
});

require('http').createServer(function (req, res) {
  res.writeHead(200, { 'Content-type': 'text/html; charset=utf-8' });
  res.end(compiler.render('index.adom'));
}).listen(8000, function () {
  console.log('Listening on port 8000');
});
```

#### SYNTAX
Tags in ADOM begin with the tag name, use the same attribute syntax as HTML, and are ended with a set of brackets (where the children go). Self closing tags are ended the same way as other tags.

```javascript
div [
  div []
]
h1 []
p [ span [] ]
span []
a href='/' []

// the programmer doesn't need to know which tags self close
input type='text' []
```

Strings are used to denote textnodes. Strings can be either single or double quoted.

```javascript
a href='/' [
  'homepage'
]
```

If a textnode is the only child of a tag, the brackets may be omitted.

``` javascript
a href='/' 'homepage'
```

Doctype is defined using the `doctype` keyword.
```javascript
doctype html
```
ADOM supports class shorthand.
```
div.class1.class2 []
```

#### DATA
Data can be easily passed to an ADOM template for rendering.
```javascript
const Adom = require('adom-js');
const compiler = new Adom({ root: './src' });

require('http').createServer(function (req, res) {
  res.writeHead(200, { 'Content-type': 'text/html; charset=utf-8' });
  res.end(compiler.render('index.adom', {
    name: 'Matt'
  }));
}).listen(8000, function () {
  console.log('Listening on port 8000');
});
```
Interpolation is done using double braces.
```javascript
html [
  head []
  body [
    h1 "Hello {{ name }}"
  ]
]
```
Data can be declared directly in the file too.
```javascript
let name = 'Matt'

html [
  head []
  body [
    h1 "Hello {{ name }}"
  ]
]
```
ADOM supports strings, booleans, numbers, arrays, objects and ternaries
```javascript
let name = 'Bob' // string
let alive = true // boolean
let age = 300
let weight = [ '200', 'lbs' ]
let location = {
  country: 'US',
  state: 'CA'
}
let happy = alive == true ? false : true
```

Data can be interpolated into strings using double braces or used directly as values.
```javascript
let name1 = { text: 'Matt' }
let name2 = name1.text

html [
  head []
  body [
    "Welcome back, {{name2}}"     
  ]
]

```

You can initialize large and complex arrays using the `repeat` keyword. The following example initializes
an array with 10 elements of value 0.
```javascript
let arr = [ repeat 0 10 ]
```

The following is how you would initialized a 10x10 2 dimensional array of empty objects.
```javascript
let arr = [ repeat [ repeat {} 10 ] 10 ]
````

To use data as an attribute value you can interpolate into a string or use single braces.
```javascript
div attr1={val1} attr2='some text {{val2}}' []
```

#### CONTROL FLOW
ADOM supports conditionals and loops.
```javascript
let items = [
  'walk dog',
  'feed dog',
  'go to work'
]

html [
  head []
  body [
    ul [
      // an optional second argument provides the index
      each (i, idx in items) [
        li "{{ i }}"
      ]
    ]
  ]
]
```
`each` can operate on objects too.
```javascript
let person = {
  name: 'Bob',
  age: 300
}

html [
  head []
  body [
    h2 "Person Details"
    ul [
      each (key, val in person) [
        li "{{ key }}: {{ val }}"
      ]
    ]
  ]
]
```
Conditionals look like this:
```javascript
let isLoggedIn = true

html [
  head []
  body [
    div [
      if (isLoggedIn) [
        p "Welcome back!"
      ] else [
        p "Please sign in."
      ]
    ]
  ]
]
```
If conditionals or loops only have a single tag in their body, the brackets may be omitted.

#### CUSTOM TAGS

ADOM supports the creation of custom tags using the `tag` keyword.

```javascript
tag MyButton [
  button "click me"
]

html [
  head []
  body [
    MyButton[]
  ]
]
```
You can pass props to tags as regular attributes, and then access them using the `props` keyword.
```javascript
tag MyButton [
  a href={props.link} [
    button "click me"
  ]
]

html [
  head []
  body [
    MyButton link='/' []
  ]
]
```
You can display children in custom tags using the `yield` keyword.
```javascript
tag MyTag [
  div [
    yield
  ]
]

html [
  head []
  body [
    MyTag [
      p "tag child"
    ]
  ]
]
```
Will produce the following HTML.
```html
<html>
  <head></head>
  <body>
    <div>
      <p>tag child</p>
    </div>
  </body>
</html>
```
Tags can be imported and exported from external ADOM files. Importing is done using paths relative to the current ADOM file, much like in javascript. Any exported tags are made available to the file doing the importing.

```javascript
// index.adom

import 'buttons.adom'

doctype html

html [
  head []
  body [
    Primary text='click' []
  ]
]

```
```javascript
// buttons.adom

tag Primary [
  button.btn-primary "{{ props.text }}"
]

export Primary

```
#### STYLES
Regular CSS can be used in the classic way using long strings (triple quotes).
```
let styles = """
body {
  background: blue;
}
"""
html [
  head [
    style "{{styles}}"
  ]
]
```
Of course, long strings can be used directly as textnodes.
```
html [
  head [
    style """
      body {
        background: blue;
      }
    """
  ]
]
```
A more preferrable way to work with CSS files is to import them into variables using the `file` keyword.
```javascript
let styles = file 'main.css'

html [
  head [
    style "{{styles}}"
  ]
]
```
ADOM supports transormations on imported files. In this example, we will use Stylus to transform our stylus files into CSS.
```javascript
// server.js
const stylus = require('stylus');

// filters are specified here in the ADOM constructor
const compiler = new Adom({
  root: 'src',
  filters: {
    stylus: function (text) {
      return stylus(text);
    }
  }
});
```
To use the filter, simply pipe your file output into it. Currently only files support pipes.
```javascript
// index.adom
let styles = file 'main.styl' | stylus

html [
  head [
    style "{{styles}}"
  ]
]
```
Tag specific styles are achieved using the special `css` tag at the top of your tags.
```javascript
tag Primary [
  css [
    background 'grey'
    padding '5px 15px'
    border-radius '3px'
  ]
  button.btn-primary "{{ props.text }}"
]
```
Style attributes are written normally, values are written in strings, and no colons or semicolons are used. All rules are applied to the tag's root element. To style a sub-element, selectors are used.
```javascript
tag Tile [
  css [
    width '500px'
    height '500px'
    background 'grey'

    '& > div' [
      box-sizing 'border-box' 
      width '100%'
      height '100%'
      padding '20px'
      background 'white'
    ] 
  ]
  div [
    div [
      h4 "{{props.title}}"
      p "{{props.body}}"
    ]
  ]
]
```
Selectors are written in strings, and follow the same basic rules as other CSS preprocessors regarding media queries and the `&` character. The `&` is substituted for the outer selector (or implicit selector in the top level's case).

#### REACTIVITY
In ADOM, client-side javascript is written between sets of dashes `--`. All chunks of javascript are executed together in the same context when the window loads. This allows for complete flexibility about how your code is structured. To activate client-side functionality, all you must do is choose an element to be the `root` element of the app.
```javascript
--
alert('hello from the client');
--

html [
  head []
  body [
    div root []
  ]
]
```
ADOM adds two simple things to your client side context:

1. Access to all data variables used by your UI
2. a `$sync()` function that updates your UI to reflect the current state of the data. This function is called automatically after event handlers are called. More on that later.

All ADOM variables are directly accessible from Javascript. Events are attached to elements using the `on` directive.
```javascript
let name = 'Matt'

--
function updateName (e) {
  name = e.target.value;
}
--

html [
  head []
  body [
    div root [
      h1 "Hello, {{name}}"
      input on:input='updateName($e)' []
    ]
  ]
]
```
In the above example, a call to `$sync()` was not needed because it was called implicitly after the javascript in the event handler. If you would like to prevent `$sync` from being called after the handler, use the `nosync` keyword after the handler like this: `input on:input='updateName($e)' nosync []`

The above example can even be shorted:
```javascript
let name = 'Matt'

html [
  head []
  body [
    div root [
      h1 "Hello, {{name}}"
      input on:input='name = $e.target.name' []
    ]
  ]
]
```
Understanding the above example, teaches you virtually all you need to know about ADOM. The only API call provided to the client is `$sync()`, and the only other bit of context that the programmer needs to memorize is `$e`, which is the event object of the current handler.

#### COMPONENTS
Let's take the counter below and componentize it.
```javascript
let count = 0

--
function increment () {
  count++
}
--

html [
  head []
  body [
    div root [
      h2 "Counter: {{ count }}"
      button on:click="increment()" "increment" 
    ]
  ]
]
```
The following will not work just yet. The problem is that javascript is not gonna know what `count` is, because it's local to a tag.
```javascript
--
function increment () {
  count++
}
--

tag Counter [
  let count = 0
  div [
    h2 "Counter: {{ count }}"
    button on:click="increment()" "increment"
  ]
]

html [
  head []
  body [
    div root [
      Counter []
    ]
  ]
]
```
The first thing we can do is pass the context to the function itself.
```javascript
--
function increment (counter) {
  counter.count++
}
--

tag Counter [
  let count = 0
  div [
    h2 "Counter: {{ count }}"
    button on:click="increment(this)" "increment"
  ]
]

html [
  head []
  body [
    div root [
      Counter []
    ]
  ]
]
```
The next thing we can do is attach the state of the tag to an instance of a class. To do this all we must do is define a class with the same name as the tag.
```javascript
--
class Counter {
  increment() {
    this.count++
  }
}
--

tag Counter [
  let count = 0
  div [
    h2 "Counter: {{ count }}"
    button on:click="this.increment()" "increment"
  ]
]

html [
  head []
  body [
    div root [
      Counter []
    ]
  ]
]

```
This is how *classical* components are achieved using ADOM. You can add an optional `mount` and `unmount` if you need to keep track of when the elements themselves are created or destroyed.
```javascript
--
class Counter {
  increment() {
    this.count++
  }
  mount () {
    alert('created')
  }
  unmount () {
    alert('destroyed')
  }
}
--

tag Counter [
  let count = 0
  div [
    h2 "Counter: {{ count }}"
    button on:click="this.increment()" "increment"
  ]
]

html [
  head []
  body [
    div root [
      Counter []
    ]
  ]
]

```
The final way do manipulate tag specific data is by directly manipulating it.
```javascript
tag Counter [
  var count = 0
  div [
    h2 "Counter: {{ count }}"
    button on:click="count++" "increment"
  ]
]

html [
  head []
  body [
    div root [ Counter[] ]
  ]
]
```
