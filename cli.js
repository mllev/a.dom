#! /usr/bin/env node

const fs = require('fs');
const path = require('path');
const dir = process.cwd();
const config = {};

const help = `
usage: adom [options]
  options:
    create <name> --ssg Create a project boilerplate with an example build script for a statically generated site
                  --ssr Create a project boilerplate for a server rendered or hybrid site
`;

const ssgBuild = `const adom = require('adom-js');

const posts = [
 { id: 'post1', content: 'Blog post 1' },
 { id: 'post2', content: 'Blog post 2' }
];

const build = async () => {
  adom.compile({
    input: 'src/index.adom',
    output: 'public/index.html,
    minify: true,
  });

  await Promise.all(posts.map(async (post) => {
    await adom.compile({
      input: 'src/blog.adom',
      output: \`public/blog/\${post.id}.html\`,
      minify: true,
      data: { post: post.content }
    });
    console.log(\`Compiled \${post.id}.html\`);
  }));
  console.log('Completed build');
};

function exec() {
  if (process.argv.includes('dev')) {
    await build()
    adom.serve({ publicDir: './public' });
  } else {
    await build();
  }
}

exec();
`;

const ssrBuild = `const adom = require('adom-js');

const prod = !process.argv.includes('dev');

const posts = {
  post1: 'Blog post 1',
  post2: 'Blog post 2'
};

adom.serve({
  publicDir: './public',
  cache: prod,
  minify: prod,
  routes: {
    '/': {
      path: 'src/index.adom'
    },
    '/blog/:post_id': {
      path: 'src/blog.adom',
      data: async (req) => {
        return { post: posts[req.params.post_id] }
      }
    }
  }
});
`;

const ssgPackageFile = (name) => `{
  "name": "${name}",
  "version": "0.0.1",
  "description": "",
  "main": "buidl.js",
  "scripts": {
    "prod": "node build",
    "dev": "node build dev"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "adom-js": "^0.19.13"
  }
}
`;

const ssrPackageFile = (name) => `{
  "name": "${name}",
  "version": "0.0.1",
  "description": "",
  "main": "server.js",
  "scripts": {
    "prod": "node server",
    "dev": "node server dev"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "adom-js": "^0.19.13"
  }
}
`;

const layoutFile = `
export tag Layout [
  html lang='en' [
    head [
      title 'A-DOM'
    ]
    body [
      yield
    ]
  ]
]
`;

const blogFile = `
import 'layout.adom'

Layout [
  main [
    h1 'Blog'
    p '{{data.post}}'
  ]
]
`;

const indexFile = `
import 'layout.adom'

Layout [
  main [
    h1 'Home'
    a href='/blog/post1' 'blog post 1'
    a href='/blog/post2' 'blog post 2'
  ]
]
`;

for (let i = 0; i < process.argv.length; i++) {
  switch (process.argv[i]) {
    case 'create':
      config.name = process.argv[++i];
      break
    case '--ssg':
      config.ssg = true;
      break
    case '--ssr':
      config.ssr = true;
      break
    default:
      break
  }
}

if (
  (config.ssr && config.ssg) ||
  (!config.ssr && !config.ssg) ||
  !config.name
) {
  console.log(help);
} else {
  const p = path.resolve(dir, config.name);

  fs.mkdirSync(p);
  fs.mkdirSync(path.join(p, 'public'));
  fs.mkdirSync(path.join(p, 'src'));
  fs.writeFileSync(path.join(p, 'src/index.adom'), indexFile);
  fs.writeFileSync(path.join(p, 'src/blog.adom'), blogFile);
  fs.writeFileSync(path.join(p, 'src/layout.adom'), layoutFile);

  if (config.ssg) {
    fs.writeFileSync(path.join(p, 'build.js'), ssgBuild);
    fs.writeFileSync(path.join(p, 'package.json'), ssgPackageFile(config.name));
  } else {
    fs.writeFileSync(path.join(p, 'server.js'), ssrBuild);
    fs.writeFileSync(path.join(p, 'package.json'), ssrPackageFile(config.name));
  }
}
