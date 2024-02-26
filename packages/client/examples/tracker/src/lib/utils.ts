export function trunc(str, len = 11, sep = '…') {
  if (str.length <= len) {
    return str;
  }
  const chars = len - sep.length;
  const frontChars = Math.ceil(chars / 2);
  const backChars = Math.floor(chars / 2);

  return str.substr(0, frontChars) + sep + str.substr(str.length - backChars);
}

export function chainName(id) {
  switch (id) {
    case '0':
      return 'polkadot';
    case '2000':
      return 'acala';
    case '2034':
      return 'hydra';
    case '2104':
      return 'manta';
    case '2004':
      return 'moonbeam';
    case '1000':
      return 'asset hub';
    default:
      return id;
  }
}
