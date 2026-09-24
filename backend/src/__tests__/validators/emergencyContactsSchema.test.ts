import { emergencyContactsSchema } from '../../validators';

const contact = (n: number) => ({ name: `Contact ${n}`, phone: `+9190000000${n}`, relation: 'Friend' });

describe('emergencyContactsSchema', () => {
  it('accepts up to three contacts (UC-R10)', () => {
    const { error } = emergencyContactsSchema.body.validate({ contacts: [1, 2, 3].map(contact) });
    expect(error).toBeUndefined();
  });

  it('refuses a fourth contact', () => {
    const { error } = emergencyContactsSchema.body.validate({ contacts: [1, 2, 3, 4].map(contact) });
    expect(error?.message).toMatch(/at most 3|less than or equal to 3/);
  });
});
