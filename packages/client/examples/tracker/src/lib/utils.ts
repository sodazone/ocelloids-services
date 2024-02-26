export function trunc(str, len = 11, sep = '…') {
    if (str.length <= len) {return str;}
    const chars = len - sep.length;
    const frontChars = Math.ceil(chars / 2);
    const backChars = Math.floor(chars / 2);
  
    return str.substr(0, frontChars) + sep + str.substr(str.length - backChars);
}