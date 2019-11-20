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

#### GETTING STARTED

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
        h1 | Welcome back, {name}! |
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
    res.end(A.render('index.adom', { name: 'Matt' }));
}).listen(5000);
```

#### GUIDE
##### SYNTAX

Tags in ADOM look like this:
```
div attr1='val1' attr2='val2' [
    div []
    div []
]
```
ADOM has no whitespace sensitivity at all:
```
div
    attr1='val1'
    attr2='val2' [ div [] div [] ]
```
Attribute syntax is largely the same as HTML. Each attribute takes the form `<attribute> '=' <string>`. ADOM supports both single and double quote strings for attributes.
```
div attr1="val1" attr2="val2" []
```
You can use the `.` shorthand for classes:
```
div.class1.class2 []
```
Self-closing tags are ended with semicolons instead of brackets:
```
img src="/img.png";
```
Pipes are used to denote text nodes:
```
h1 [
    | I AM SOME TEXT! |
]
```
If a textnode is the only child of a tag, the brackets may be omitted:
```
h1 | I AM SOME TEXT! |
```