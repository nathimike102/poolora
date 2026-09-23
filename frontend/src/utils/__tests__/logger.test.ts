import { logger } from '../logger';

describe('logger', () => {
  it('prints the name, message and code of an Error instead of {}', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const error = Object.assign(new Error('DEVELOPER_ERROR'), { code: '10' });

    logger.error('Google sign-in failed', { error });

    const line = spy.mock.calls[0][0] as string;
    expect(line).toContain('"message":"DEVELOPER_ERROR"');
    expect(line).toContain('"code":"10"');
    expect(line).not.toContain('"error":{}');
    spy.mockRestore();
  });
});
