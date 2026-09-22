import { updateMeSchema } from '../../validators';

describe('updateMeSchema', () => {
  it('accepts a date of birth from profile setup', () => {
    const { error, value } = updateMeSchema.body.validate({ name: 'Ghost Ghoul', dateOfBirth: '2000-09-22T00:00:00.000Z' });
    expect(error).toBeUndefined();
    expect(value.dateOfBirth).toBeInstanceOf(Date);
  });

  it('rejects a date of birth in the future', () => {
    const { error } = updateMeSchema.body.validate({ dateOfBirth: '2999-01-01T00:00:00.000Z' });
    expect(error).toBeDefined();
  });
});
