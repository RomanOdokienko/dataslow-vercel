const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const outDir = path.join(__dirname, '.tmp');
fs.rmSync(outDir, { recursive: true, force: true });
try {
  execSync(`tsc ${path.join('pages','api','stats.ts')} --outDir ${outDir} --esModuleInterop --skipLibCheck --lib ES2019,DOM --moduleResolution node`, { stdio: 'ignore' });
} catch { /* compilation errors are ignored */ }
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(request){
  if (request === 'pg') {
    return { Pool: class { query() { return Promise.resolve({ rows: [] }); } } };
  }
  return originalRequire.call(this, request);
};
const handler = require(path.join(outDir, 'stats.js')).default;
async function run(){
  const cases=[
    { query:{}, desc:'no parameters'},
    { query:{hourly:'true'}, desc:'hourly=true'},
    { query:{daily:'false'}, desc:'invalid daily'},
    { query:{daily:'true'}, desc:'daily=true'}
  ];
  for(const c of cases){
    const req={method:'GET', query:c.query};
    const res={headers:{}, statusCode:0, body:null,
      setHeader(k,v){this.headers[k]=v;},
      status(code){this.statusCode=code; return this;},
      json(b){this.body=b; return this;},
      end(){}}
    await handler(req,res);
    console.log(c.desc, res.statusCode, res.body);
  }
  fs.rmSync(outDir, { recursive: true, force: true });
}
run();
