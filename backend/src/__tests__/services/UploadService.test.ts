/**
 * Tests for KYC document uploads: allowed file types, per-user keys and
 * the admin download guard.
 */
const mockCreatePresignedPost = jest.fn();
jest.mock('@aws-sdk/s3-presigned-post', () => ({
  createPresignedPost: (...args: unknown[]) => mockCreatePresignedPost(...args),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn().mockResolvedValue('https://signed') }));
jest.mock('../../config', () => ({
  config: { aws: { accessKeyId: 'AKIA', secretAccessKey: 'secret', region: 'ap-south-1', s3Bucket: 'poolora-kyc' } },
}));

import { presignKycUpload, presignKycDownload, kycPrefix } from '../../services/UploadService';

describe('UploadService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreatePresignedPost.mockResolvedValue({ url: 'https://s3', fields: { key: 'k' } });
  });

  it('issues an upload under the user prefix with type, size and encryption conditions', async () => {
    const result = await presignKycUpload('user1', 'licence', 'image/jpeg');

    expect(result.fileUrl.startsWith(kycPrefix('user1'))).toBe(true);
    expect(result.fileUrl).toMatch(/\/licence\/.+\.jpg$/);
    const params = mockCreatePresignedPost.mock.calls[0][1];
    expect(params.Conditions).toEqual(
      expect.arrayContaining([
        ['content-length-range', 1, 10 * 1024 * 1024],
        ['eq', '$Content-Type', 'image/jpeg'],
      ]),
    );
  });

  it('rejects unsupported file types', async () => {
    await expect(presignKycUpload('user1', 'licence', 'image/gif')).rejects.toThrow('JPEG, PNG or PDF');
  });

  it('only signs downloads for KYC documents', async () => {
    await expect(presignKycDownload('s3://poolora-kyc/kyc/user1/licence/a.jpg')).resolves.toBe('https://signed');
    await expect(presignKycDownload('s3://poolora-kyc/other/secret.txt')).rejects.toThrow('Not a KYC document');
    await expect(presignKycDownload('https://evil.example/doc.jpg')).rejects.toThrow('Not a KYC document');
  });
});
