#! /usr/bin/env node

let adom = require('./index')
let fs = require('fs')
let path = require('path')
let config = {}
let dir = process.cwd()
let routes = {};
let help = `
usage: adom [options]
  options:
    create <name> Create a project boilerplate
    dev           start a development server that statically serves a directory
    -p <name>     the public directory for the development server
    -r <route>    a route so the development server knows how to map adom files to urls
                  example: adom dev -r /=index.adom -r /home=home.adom
`

/***
 
  adom create --spa --backend
  adom create --mpa --static
  adom create --mpa --dynamic
  
  
  SPA
  
  adom.app({
    publicDir: './public',
    routes: {
      '*': {
        path: 'src/index.adom'
      }
    }
  });

  MPA

  adom.app({
    publicDir: './public',
    routes: {
      '/': {
        path: 'src/home.adom'
      },
      '/about': {
        path: 'src/about.adom'
      },
      '/blog/:post_id': {
        path: 'src/blog.adom',
        data: async () => {
          return { post: 'Blog post 1' }
        }
      }
    }
  });

  SSG

  adom.compile

  STATIC SPA

  adom.compile([
    { input: '
  ])
  
 ***/

for (let i = 0; i < process.argv.length; i++) {
  switch (process.argv[i]) {
    case '-o':
      config.out = process.argv[++i]
      break
    case '-p':
      config.devPort = process.argv[++i]
      break
    case '-r':
      let route = process.argv[++i];
      let parts = route.split('=');
      if (parts.length === 2) {
        routes[parts[0]] = parts[1];
      }
      break
    case '--dev':
      config.dev = true;
      break
    case '--minify':
      config.minify = true;
      break
    case '--new':
      config.starter = true;
      config.app = process.argv[++i];
      break
    default:
      config.file = process.argv[i];
      break
  }
}

