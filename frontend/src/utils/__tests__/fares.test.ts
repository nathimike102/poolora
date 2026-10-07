import { riderPays } from '../fares';

describe('what the rider pays', () => {
  test('is the fare less the company\'s part, as the server charges', () => {
    expect(riderPays({ estimatedFare: 10, companyShare: 5 })).toBe(5);
    expect(riderPays({ estimatedFare: 10, finalFare: 10, companyShare: 2.5 })).toBe(7.5);
    expect(riderPays({ estimatedFare: 3.3 })).toBe(3.3);
    expect(riderPays({ estimatedFare: 4, companyShare: 6 })).toBe(0);
  });
});
