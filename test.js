const Compile = require('./index')

let test = `
html [
  body [
    h1 | List 1 |
    ul [
      each item in items1 [
        li | {item} |
      ]
    ]
    h1 | List 2 |
    ul [
      each item in items2 [
        li | {item.data} |
      ]
    ]
  ]
]
`

let html = Compile(test, {
  items1: [
    'walk the dog',
    'buy a cheeseburger'
  ],
  items2: [
    { data: 'walk the cheeseburger' },
    { data: 'buy a dog' }
  ]
})

console.log(html)