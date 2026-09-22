import { realPhone } from '../phone';

test('hides the placeholder given to Google and email accounts', () => {
  expect(realPhone('firebase:vV52ThsCXFXNu0H53en5eOGDoJm1')).toBeUndefined();
  expect(realPhone('+919876543210')).toBe('+919876543210');
  expect(realPhone(undefined)).toBeUndefined();
});
