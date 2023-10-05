import fs from 'node:fs';

let _version : string;

export default function version() : string {
  if (_version) {
    return _version;
  }

  const p = JSON.parse(
    fs.readFileSync(
      new URL('../package.json', import.meta.url),
      'utf-8'
    )
  );
  _version = p.version;

  return _version;
}
