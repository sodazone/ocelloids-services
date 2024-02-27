import samples from '../../.misc/data/samples.json';

export function sender(cb) {
  let index = 0;

  function send() {
    setTimeout(() => {
      cb(samples[index]);
      index++;
      if (index < samples.length) {
        send();
      }
    }, 3000);
  }

  send();
}
