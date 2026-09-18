import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { AppError } from '../utils/AppError';

export type KycDocumentPurpose = 'licence' | 'registration' | 'insurance' | 'vehicle-photo';

const CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};
const MAX_BYTES = 10 * 1024 * 1024;
const EXPIRES_SECONDS = 300;

let client: S3Client | null = null;
function s3(): S3Client {
  if (!config.aws.accessKeyId || !config.aws.secretAccessKey) {
    throw new AppError('Document uploads are not configured', 503, 'UPLOADS_UNAVAILABLE');
  }
  client ??= new S3Client({
    region: config.aws.region,
    credentials: { accessKeyId: config.aws.accessKeyId, secretAccessKey: config.aws.secretAccessKey },
  });
  return client;
}

/** Every KYC file for a user lives under this prefix; submissions must stay inside it. */
export function kycPrefix(userId: string): string {
  return `s3://${config.aws.s3Bucket}/kyc/${userId}/`;
}

/**
 * Presigned POST for one KYC document. The policy pins the key, content type
 * and a 10 MB size limit, and objects are encrypted at rest by S3.
 */
export async function presignKycUpload(
  userId: string,
  purpose: KycDocumentPurpose,
  contentType: string,
): Promise<{ url: string; fields: Record<string, string>; fileUrl: string }> {
  const ext = CONTENT_TYPES[contentType];
  if (!ext) throw new AppError('Upload a JPEG, PNG or PDF file', 400, 'UNSUPPORTED_FILE_TYPE');

  const key = `kyc/${userId}/${purpose}/${uuidv4()}.${ext}`;
  const { url, fields } = await createPresignedPost(s3(), {
    Bucket: config.aws.s3Bucket,
    Key: key,
    Expires: EXPIRES_SECONDS,
    Fields: { 'Content-Type': contentType, 'x-amz-server-side-encryption': 'AES256' },
    Conditions: [
      ['content-length-range', 1, MAX_BYTES],
      ['eq', '$Content-Type', contentType],
      ['eq', '$x-amz-server-side-encryption', 'AES256'],
    ],
  });

  return { url, fields, fileUrl: `s3://${config.aws.s3Bucket}/${key}` };
}

/** Short-lived link for an admin to view a stored KYC document. */
export async function presignKycDownload(fileUrl: string): Promise<string> {
  const prefix = `s3://${config.aws.s3Bucket}/`;
  if (!fileUrl.startsWith(`${prefix}kyc/`)) {
    throw new AppError('Not a KYC document', 400, 'INVALID_DOCUMENT');
  }
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: config.aws.s3Bucket, Key: fileUrl.slice(prefix.length) }),
    { expiresIn: EXPIRES_SECONDS },
  );
}
