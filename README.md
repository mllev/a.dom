<h1 align="center">
	<br>
    <img width="200" src="https://raw.githubusercontent.com/mllev/a.dom/master/logo.png">
    <br>
</h1>

## a.dom

Advanced Data Oriented Markup

ADOM is a templating language with extremely advanced features.

In just 2k lines of code, with no dependencies, and a single function API, ADOM packs in:

- a templating language that looks and feels more like a programming language, providing a robust and predictable syntax for HTML
- a high speed reactive UI engine
- no configuration code separation and bundling via simple import/export semantics
- server side rendering that is simpler, faster, and *far* easier to understand than all modern solutions

#### GUIDE

Getting started with ADOM is very easy.

```
npm install adom-js
```

First, create a basic node server.
```js
require('http').createServer((req, res) => {
    res.writeHead(200, { 'Content-type': 'text/html' });
    res.end('<h1>Hello!</h1>');
}).listen(5000);
```

Next, create an instance of the ADOM compiler.
```js
const adom = require('adom-js');
const A = new adom({
    rootDir: '.' // tell adom where to look for adom files
});

require('http').createServer((req, res) => {
    res.writeHead(200, { 'Content-type': 'text/html' });
    res.end('<h1>Hello!</h1>');
}).listen(5000);
```

Then, create an `index.adom` file in the same directory as your server file.
```
doctype html5

html [
    head []
    body [
        h1 | Hello! |
    ]
]
```

Finally, serve your `index.adom` file.
```js
const adom = require('adom-js');
const A = new adom({
    rootDir: '.' // tell adom where to look for adom files
});

require('http').createServer((req, res) => {
    res.writeHead(200, { 'Content-type': 'text/html' });
    res.end(A.render('index.adom', {}));
}).listen(5000);
```