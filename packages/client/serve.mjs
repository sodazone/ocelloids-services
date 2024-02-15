import http from 'http';
import flah from 'finalhandler';
import serveStatic from 'serve-static';

const home = serveStatic('./__browser__');
const bundle = serveStatic('./dist');

const server = http.createServer((req, res) => {
  const done = flah(req, res);
  
  console.log(req.url)

  if(req.url === '/') {
    home(req, res, done);
  } else {
    bundle(req, res, done);
  }
});

server.listen(8000);
