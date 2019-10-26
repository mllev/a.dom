const Adom = require("./index");
const fs = require("fs");
const http = require("http");

const compiler = new Adom({ cache: false });

http
  .createServer(function(req, res) {
    const html = compiler.compile_file("example.adom", {
      name: "matt",
      items: [
        { text: "buy a house", date: "01/01/3000" },
        { text: "sell a house", date: "01/01/4000" }
      ]
    });
    res.setHeader("Content-Type", "text/html");
    res.end(html);
  })
  .listen(5000, function() {
    console.log("listening on port 5000");
  });
