/**
 * One document that cannot be signed must not block the whole review: it is
 * listed as unavailable and the others still open.
 */
jest.mock('../../models/User', () => ({ User: { findById: jest.fn() } }));
jest.mock('../../services/UploadService', () => ({
  presignKycDownload: jest.fn((url: string) =>
    url.includes('bad') ? Promise.reject(new Error('Not a KYC document')) : Promise.resolve(`https://signed/${url.slice(5)}`)),
}));

import { User } from '../../models/User';
import { getKycDocuments } from '../../controllers/AdminController';

it('lists an unsignable document as unavailable and returns the rest', async () => {
  (User.findById as jest.Mock).mockReturnValue({
    select: jest.fn().mockResolvedValue({
      name: 'Naveen',
      kyc: { status: 'pending', drivingLicenseUrl: 's3://b/kyc/u/dl.jpg' },
      vehicles: [{ make: 'Maruti', registrationDocUrl: 's3://bad/reg.jpg', insuranceDocUrl: 's3://b/kyc/u/ins.jpg', photos: [] }],
    }),
  });
  const json = jest.fn();
  const next = jest.fn();
  await getKycDocuments({ params: { userId: 'u1' }, requestId: 'r' } as never, { status: () => ({ json }) } as never, next);

  expect(next).not.toHaveBeenCalled();
  const body = json.mock.calls[0][0].data;
  expect(body.documents.licence).toBe('https://signed/b/kyc/u/dl.jpg');
  expect(body.documents.registration).toBeNull();
  expect(body.unavailable).toEqual(['registration']);
});
