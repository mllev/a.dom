const Compile = require('./index')
// const fs = require('fs')

let html

function benchmark (fn) {
  const hrstart = process.hrtime()
  fn()
  const hrend = process.hrtime(hrstart)
  console.info('Execution time (hr): %ds %dms', hrend[0], hrend[1] / 1000000)
}

let test = `
html [
  body [
    h1 class='#{h1class1} #{h1class2}' | List 1 |
    if 10 > 8 [
      div | 10 greater than 8 |
      if 1 >= 2 [
        ul.class-shorthand [
          each item in items1 [
            li | #{item} |
          ]
        ]
      ] else [
        span | ELSE CLAUSE |
      ]
    ]
    h1 | List 2 |
    ul [
      each item in items2 [
        li | #{item.data} |
      ]
    ]
    h1 | List 2 |
    ul [
      each item in items3 [
        each i in item [
          li | #{i} |
        ]
      ]
    ]
  ]
]
`

benchmark(() => {
  // let test = fs.readFileSync('big-test.template', 'utf-8')
  html = Compile(test, {
    h1class1: 'font-thin',
    h1class2: 'font-blue',
    items1: [
      'walk the dog',
      'buy a cheeseburger'
    ],
    items2: [
      { data: 'walk the cheeseburger' },
      { data: 'buy a dog' }
    ],
    items3: [
      [
        'sell car',
        'buy more expensive car'
      ]
    ]
  })
})

console.log(html)
