const Compile = require('./index')
const fs = require('fs')

let html

function benchmark (fn) {
  const hrstart = process.hrtime()
  fn()
  const hrend = process.hrtime(hrstart)
  console.info('Execution time (hr): %ds %dms', hrend[0], hrend[1] / 1000000)
}

let test = `
tag Button [
  a href='/' [
    button.button-styles | click |
    span.button-flare []
  ]
]

html [
  body [
    h1 class='#{h1class1[0]} #{h1class2}' | List 1 |
    if 10 > 8 {
      div | 10 greater than 8 |
      if 1 <= 2 {
        ul.class-shorthand [
          each item in items1[0].items1inner {
            li | #{item} |
          }
        ]
      } else {
        span | ELSE CLAUSE |
      }
    }
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
]
`

benchmark(() => {
  // let test = fs.readFileSync('big-test.template', 'utf-8')
  html = Compile(test, {
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
