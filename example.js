const Adom = require('./index')
const fs = require('fs')
const http = require('http')

const compiler = new Adom({ cache: false })

const html = compiler.compile_file('example.adom', {
  href: '/logout',
  name: 'matt',
  items: [
    { text: 'buy a house', date: '01/01/3000' },
    { text: 'sell a house', date: '01/01/4000' }
  ],
  testObj: {
    key1: 'val1',
    key2: 'val2',
    key3: 'val3',
  }
})

console.log(html)
