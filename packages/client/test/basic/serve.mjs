import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import flah from 'finalhandler';
import serveStatic from 'serve-static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const home = serveStatic(__dirname);
const bundle = serveStatic(__dirname + '/../../dist');

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
