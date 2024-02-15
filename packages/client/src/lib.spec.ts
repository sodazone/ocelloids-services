import { hello } from './lib';

describe('Hello', () => {
  it('should return a greeting', () => {
    expect(hello()).toEqual('hello');
  });
});