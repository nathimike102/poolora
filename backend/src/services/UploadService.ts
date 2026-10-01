import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { AppError } from '../utils/AppError';

/** identity and selfie are for the identity check behind women-only rides (IdentityService) */
export type KycDocumentPurpose = 'licence' | 'registration' | 'insurance' | 'vehicle-photo' | 'identity' | 'selfie';

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

/**
 * SOS audio lives with the incident, not the person: closing an account
 * must not delete evidence of a real incident. Recordings are AAC in an
 * MPEG-4 file (.m4a), which is what the app records on both platforms.
 */
const AUDIO_TYPES: Record<string, string> = { 'audio/mp4': 'm4a', 'audio/m4a': 'm4a', 'audio/aac': 'aac' };

export function sosEvidencePrefix(emergencyId: string): string {
  return `s3://${config.aws.s3Bucket}/sos/${emergencyId}/`;
}

/** Presigned POST for one chunk of SOS audio (UC-R07 step 7). */
export async function presignSosAudioUpload(
  emergencyId: string,
  contentType: string,
): Promise<{ url: string; fields: Record<string, string>; fileUrl: string }> {
  const ext = AUDIO_TYPES[contentType];
  if (!ext) throw new AppError('Upload an M4A or AAC recording', 400, 'UNSUPPORTED_FILE_TYPE');
  const key = `sos/${emergencyId}/${new Date().toISOString().replace(/[:.]/g, '-')}-${uuidv4().slice(0, 8)}.${ext}`;
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

/** Short-lived link for an admin to listen to SOS audio. */
export async function presignSosDownload(fileUrl: string): Promise<string> {
  const prefix = `s3://${config.aws.s3Bucket}/`;
  if (!fileUrl.startsWith(`${prefix}sos/`)) throw new AppError('Not SOS evidence', 400, 'INVALID_DOCUMENT');
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: config.aws.s3Bucket, Key: fileUrl.slice(prefix.length) }),
    { expiresIn: 15 * 60 },
  );
}

/** Deletes an incident's recordings (a false alarm past its retention). */
export async function deleteSosEvidence(emergencyId: string): Promise<number> {
  if (!config.aws.accessKeyId || !config.aws.secretAccessKey || !config.aws.s3Bucket) return 0;
  const page = await s3().send(new ListObjectsV2Command({ Bucket: config.aws.s3Bucket, Prefix: `sos/${emergencyId}/` }));
  const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
  if (keys.length) await s3().send(new DeleteObjectsCommand({ Bucket: config.aws.s3Bucket, Delete: { Objects: keys, Quiet: true } }));
  return keys.length;
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

/**
 * Deletes particular private files, given their s3:// references (identity
 * photos once reviewed). Throws if the store refuses, so the caller can keep
 * the references and try again.
 */
export async function deleteKycFiles(fileUrls: string[]): Promise<number> {
  if (!config.aws.accessKeyId || !config.aws.secretAccessKey || !config.aws.s3Bucket) return 0;
  const prefix = `s3://${config.aws.s3Bucket}/`;
  const keys = fileUrls.filter((u) => u.startsWith(`${prefix}kyc/`)).map((u) => ({ Key: u.slice(prefix.length) }));
  if (!keys.length) return 0;
  const result = await s3().send(new DeleteObjectsCommand({ Bucket: config.aws.s3Bucket, Delete: { Objects: keys, Quiet: true } }));
  if (result.Errors?.length) throw new Error(`S3 refused ${result.Errors.length} deletions`);
  return keys.length;
}

/**
 * Deletes every KYC file stored for a user (when they close their account).
 * Returns how many objects were removed; 0 when uploads are not configured.
 */
export async function deleteKycDocuments(userId: string): Promise<number> {
  if (!config.aws.accessKeyId || !config.aws.secretAccessKey || !config.aws.s3Bucket) return 0;
  const Prefix = `kyc/${userId}/`;
  let removed = 0;
  let ContinuationToken: string | undefined;
  do {
    const page = await s3().send(new ListObjectsV2Command({ Bucket: config.aws.s3Bucket, Prefix, ContinuationToken }));
    const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
    if (keys.length) {
      await s3().send(new DeleteObjectsCommand({ Bucket: config.aws.s3Bucket, Delete: { Objects: keys, Quiet: true } }));
      removed += keys.length;
    }
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return removed;
}
