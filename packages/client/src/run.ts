import { root } from './placeholder';

root().then(async res =>
  console.log(await res.text())
);