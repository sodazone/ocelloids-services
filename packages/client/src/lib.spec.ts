import { hello } from './main';

describe('Hello', () => {
  it('should return a greeting', () => {
    expect(hello()).toEqual('hello');
  });
});