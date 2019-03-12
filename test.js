const Compile = require('./index')
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

tag Button text1 text2 [
  a href='/' [
    button.button-styles | #{text1} |
    span.button-flare []
  ]
]

tag MyForm submitMsg [
  form action='/' method='POST' [
    input name='email';
    input name='password' type='password';
    input name='submit' type='submit' value='#{submitMsg}';
    [ Button buttonText1[0] ]
    [ Button buttonText2[0] ]
  ]
]

html [
  body [
    [ MyForm 'submit' ]
    [ MyForm 'submit' ]
    h1 class='#{h1class1[0]} #{h1class2}' | List 1 |
    if testNum.val[0][1] >= testNum.val[0][0] {
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
    [ Button ]
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
  // let test = fs.readFileSync('big-test.template', 'utf-8')
  html = Compile(test, {
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
  })
})

console.log(html)
