const adom = require('./index')
const fs = require('fs')

let html

function benchmark (fn) {
  const hrstart = process.hrtime()
  fn()
  const hrend = process.hrtime(hrstart)
  console.info('Execution time (hr): %ds %dms', hrend[0], hrend[1] / 1000000)
}

let test =
`doctype html5

block Button text1 text2 [
  a href='/' [
    button.button-styles | #{text1} |
    span.button-flare []
    if text1 != null {
      span | NULL |
    } else {
      span | NOT NULL |
    }
  ]
]

block MyForm submitMsg [
  form action='/' method='POST' [
    input name='email';
    input name='password' type='password';
    input name='submit' type='submit' value='#{submitMsg}';
    [ Button buttonText1[0] ]
    [ Button buttonText2[0] ]
  ]
]

const pageTitle :json '
  {
    "data": [
      "PAGE TITLE 1",
      "PAGE TITLE 2"
    ]
  }
'

const adomTest :adom ' h1 | HELLO FROM ADOM | '

const behavior '
  function doSomething () {
    alert("yo!!!")
  }
'

const styles '
  body {
    background: blue;
  }
'

block Head [
  head [
    title  | #{pageTitle.data[1]} |
    style  | #{styles}    |
    script | #{behavior}  |
  ]
]

html [
  body [
    div | #{adomTest} |
    [ Head ]
    [ MyForm 'submit' ]
    [ MyForm 'submit' ]
    h1 class='#{h1class1[0]} #{h1class2}' | List 1 |
    if testNum.val[0][1] <= testNum.val[0][0] {
      div | #{testNum.val[0][1]} less than #{testNum.val[0][0]} |
      if 1 <= 2 {
        ul.class-shorthand [
          each item in items1[0].items1inner {
            li | #{item} |
          }
        ]
      } else {
        span | ELSE CLAUSE |
      }
    } else { span | NOPE | }
    [ Button 'foo' ]
    h1 | List 2 |
    ul [
      each item in items2 {
        li | #{item.data} |
      }
    ]
    h1 | List 2 |
    ul [
      each item in items3 {
        each x in item {
          li | #{x[0]} |
        }
      }
    ]
  ]
]`

benchmark(() => {
  html = adom.compileString(test, {
    buttonText1: ['CLICK ME'],
    buttonText2: ['REGISTER'],
    testNum: { val: [[500, 400]] },
    h1class1: ['font-thin'],
    h1class2: 'font-blue',
    items1: [
      { items1inner: ['feed the fish', 'eat the fish'] },
      'walk the dog',
      'buy a cheeseburger'
    ],
    items2: [
      { data: 'walk the cheeseburger' },
      { data: 'buy a dog' }
    ],
    items3: [
      [
        [ 'sell car' ],
        [ 'buy more expensive car' ]
      ]
    ]
  }, {
    formatted: true,
    filters: {
      adom: adom.compileString 
    }
  })
})

console.log(html)
