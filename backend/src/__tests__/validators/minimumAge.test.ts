/** Poolora is for adults: signing up and editing the profile refuse anyone under 18 */
import { MIN_USER_AGE, updateMeSchema, verifyOtpSchema } from '../../validators';

const yearsAgo = (years: number, days = 0) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const signup = (dateOfBirth: string) =>
  verifyOtpSchema.body.validate({ phone: '+263771234567', otp: '123456', name: 'Test', dateOfBirth });

it('refuses a 12-year-old and someone a day short of 18', () => {
  expect(signup(yearsAgo(12)).error?.message).toBe(`You must be at least ${MIN_USER_AGE} to use Poolora`);
  expect(signup(yearsAgo(18, 1)).error).toBeDefined();
  expect(updateMeSchema.body.validate({ dateOfBirth: yearsAgo(16) }).error).toBeDefined();
});

it('accepts an 18th birthday today and older adults', () => {
  expect(signup(yearsAgo(18)).error).toBeUndefined();
  expect(signup('1995-09-15').error).toBeUndefined();
  expect(updateMeSchema.body.validate({ dateOfBirth: '1980-01-01' }).error).toBeUndefined();
});
