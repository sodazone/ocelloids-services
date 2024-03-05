import { dirSize } from './disk.js';

describe('disk usage', () => {
  it('should get the size of the current directory', async () => {
    expect(await dirSize('.')).toBeGreaterThan(0);
  });
});
