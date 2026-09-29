/**
 * DocumentCheckService.ts
 *
 * Automatic checks on a driver application (UC-A01 step 3), run when it
 * arrives and again on request. They help the admin; they never approve or
 * reject on their own.
 *
 * Checked here, with no outside service:
 * - the licence number has the Indian format (state, RTO, year, number) and
 *   a real state code; the plate is a valid registration or BH-series number
 * - the licence year is not in the future and the driver was 18 when it was issued
 * - no other account uses the same licence number or plate
 * - the vehicle is under 15 years old
 * - the uploaded files exist and are images or PDFs of a sensible size (when S3 is set up)
 *
 * With a background-check vendor connected (KYC_VERIFY_URL), the licence and
 * registration are also sent there, and its answer ("clear" or "consider")
 * is stored for the admin. Vendors differ, so the call uses one small JSON
 * contract that an adapter can map to the vendor's API; see sendToVendor.
 */

import axios from 'axios';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { User, IUser } from '../models/User';
import { IKYCData } from '../types';
import { config } from '../config';
import { logger } from '../utils/logger';

type Result = NonNullable<IKYCData['autoChecks']>[number];

/** Indian state and union territory codes used on licences and plates */
const STATE_CODES = new Set([
  'AN', 'AP', 'AR', 'AS', 'BR', 'CG', 'CH', 'DD', 'DL', 'DN', 'GA', 'GJ', 'HP', 'HR', 'JH', 'JK', 'KA', 'KL', 'LA', 'LD',
  'MH', 'ML', 'MN', 'MP', 'MZ', 'NL', 'OD', 'OR', 'PB', 'PY', 'RJ', 'SK', 'TG', 'TN', 'TR', 'TS', 'UK', 'UA', 'UP', 'WB',
]);

const clean = (s?: string) => String(s ?? '').toUpperCase().replace(/[\s-]/g, '');

/** SS RR YYYY NNNNNNN: state, RTO, year of issue, serial */
export function parseLicence(number?: string): { state: string; year: number } | null {
  const m = /^([A-Z]{2})(\d{2})((?:19|20)\d{2})(\d{7})$/.exec(clean(number));
  return m ? { state: m[1], year: Number(m[3]) } : null;
}

/** KA01AB1234, DL3CAB1234, or the BH series 22BH1234AA */
export function parsePlate(plate?: string): { state: string | null } | null {
  const p = clean(plate);
  if (/^\d{2}BH\d{4}[A-Z]{1,2}$/.test(p)) return { state: null };
  const m = /^([A-Z]{2})\d{1,2}[A-Z]{0,3}\d{4}$/.exec(p);
  return m ? { state: m[1] } : null;
}

let s3client: S3Client | null = null;

export class DocumentCheckService {
  /** Runs the checks on a user's application and stores the results */
  async run(userId: string): Promise<Result[]> {
    const user = await User.findById(userId);
    if (!user) return [];
    const results = await this.checks(user);
    await User.updateOne({ _id: user._id }, { $set: { 'kyc.autoChecks': results, 'kyc.autoCheckedAt': new Date() } });
    return results;
  }

  /** Runs the checks and, when a vendor is connected, starts the background check. Never throws. */
  async onSubmitted(userId: string): Promise<void> {
    try {
      await this.run(userId);
      if (config.kycVerify.url) await this.sendToVendor(userId);
    } catch (error) {
      logger.error('Automatic document checks failed', { userId, error: (error as Error).message });
    }
  }

  async checks(user: IUser): Promise<Result[]> {
    const out: Result[] = [];
    const vehicle = user.vehicles?.[user.vehicles.length - 1];
    const now = new Date();

    const licence = parseLicence(user.kyc?.licenseNumber);
    if (!licence) {
      out.push({ check: 'Licence number format', result: 'fail', detail: `"${user.kyc?.licenseNumber ?? ''}" is not in the SS-RR-YYYY-NNNNNNN format.` });
    } else if (!STATE_CODES.has(licence.state)) {
      out.push({ check: 'Licence number format', result: 'fail', detail: `"${licence.state}" is not an Indian state code.` });
    } else if (licence.year > now.getFullYear()) {
      out.push({ check: 'Licence number format', result: 'fail', detail: `The licence year ${licence.year} is in the future.` });
    } else {
      out.push({ check: 'Licence number format', result: 'pass', detail: `Issued in ${licence.state} in ${licence.year}.` });
    }

    if (licence && user.dateOfBirth) {
      const ageAtIssue = licence.year - new Date(user.dateOfBirth).getFullYear();
      out.push(ageAtIssue < 18
        ? { check: 'Age at licence issue', result: 'fail', detail: `The driver would have been ${ageAtIssue} when the licence was issued.` }
        : { check: 'Age at licence issue', result: 'pass', detail: `About ${ageAtIssue} at issue.` });
    } else if (!user.dateOfBirth) {
      out.push({ check: 'Age at licence issue', result: 'warn', detail: 'No date of birth on the profile to compare.' });
    }

    const plate = parsePlate(vehicle?.plateNumber);
    if (!plate) out.push({ check: 'Registration number format', result: 'fail', detail: `"${vehicle?.plateNumber ?? ''}" is not a valid Indian registration number.` });
    else if (plate.state && !STATE_CODES.has(plate.state)) out.push({ check: 'Registration number format', result: 'fail', detail: `"${plate.state}" is not an Indian state code.` });
    else out.push({ check: 'Registration number format', result: 'pass', detail: plate.state ? `Registered in ${plate.state}.` : 'Bharat (BH) series.' });

    if (user.kyc?.licenseNumber) {
      const others = await User.find({ _id: { $ne: user._id }, 'kyc.licenseNumber': user.kyc.licenseNumber }).select('name').limit(3).lean();
      out.push(others.length
        ? { check: 'Licence used elsewhere', result: 'fail', detail: `The same licence number is on ${others.map((o) => o.name).join(', ')}.` }
        : { check: 'Licence used elsewhere', result: 'pass', detail: 'No other account uses this licence.' });
    }
    if (vehicle?.plateNumber) {
      const others = await User.find({ _id: { $ne: user._id }, 'vehicles.plateNumber': vehicle.plateNumber, 'kyc.status': 'approved' }).select('name').limit(3).lean();
      out.push(others.length
        ? { check: 'Vehicle used elsewhere', result: 'warn', detail: `An approved driver (${others.map((o) => o.name).join(', ')}) has the same plate. Shared family cars are fine; check the RC owner.` }
        : { check: 'Vehicle used elsewhere', result: 'pass', detail: 'No approved driver has this plate.' });
    }

    if (vehicle?.year) {
      const age = now.getFullYear() - vehicle.year;
      out.push(age >= 15
        ? { check: 'Vehicle age', result: 'fail', detail: `${age} years old; commercial passenger use needs a vehicle under 15 years.` }
        : { check: 'Vehicle age', result: 'pass', detail: `${age} years old.` });
    }

    out.push(...(await this.fileChecks([
      ['Driving licence file', user.kyc?.drivingLicenseUrl],
      ['Registration file', vehicle?.registrationDocUrl],
      ['Insurance file', vehicle?.insuranceDocUrl],
    ])));
    return out;
  }

  /** The uploaded files exist in S3 and are images or PDFs between 20 KB and 10 MB */
  private async fileChecks(files: Array<[string, string | undefined]>): Promise<Result[]> {
    if (!config.aws.accessKeyId || !config.aws.secretAccessKey) return [];
    s3client ??= new S3Client({ region: config.aws.region, credentials: { accessKeyId: config.aws.accessKeyId, secretAccessKey: config.aws.secretAccessKey } });
    const prefix = `s3://${config.aws.s3Bucket}/`;
    const out: Result[] = [];
    for (const [check, url] of files) {
      if (!url?.startsWith(prefix)) {
        out.push({ check, result: 'fail', detail: 'Not uploaded.' });
        continue;
      }
      try {
        const head = await s3client.send(new HeadObjectCommand({ Bucket: config.aws.s3Bucket, Key: url.slice(prefix.length) }));
        const size = head.ContentLength ?? 0;
        const type = head.ContentType ?? '';
        if (!/^(image\/(jpeg|png)|application\/pdf)$/.test(type)) out.push({ check, result: 'fail', detail: `Unexpected file type ${type || 'unknown'}.` });
        else if (size < 20_000) out.push({ check, result: 'warn', detail: `Only ${Math.round(size / 1000)} KB; it may be too blurry to read.` });
        else out.push({ check, result: 'pass', detail: `${type === 'application/pdf' ? 'PDF' : 'Image'}, ${Math.round(size / 1000)} KB.` });
      } catch {
        out.push({ check, result: 'fail', detail: 'The file is missing from storage.' });
      }
    }
    return out;
  }

  /**
   * Sends the application to the background-check vendor.
   *
   * Request (POST, JSON, Bearer KYC_VERIFY_API_KEY):
   *   { reference, name, dateOfBirth, phone, licenceNumber, registrationNumber, callbackUrl }
   * Response: { status: "clear" | "consider" | "pending", reference?, summary? }
   * A later answer can be posted to callbackUrl with the same body.
   */
  async sendToVendor(userId: string): Promise<void> {
    const user = await User.findById(userId).select('name dateOfBirth phone kyc vehicles').lean();
    if (!user) return;
    const vehicle = user.vehicles?.[user.vehicles.length - 1];
    await User.updateOne({ _id: userId }, { $set: { 'kyc.backgroundCheck': { status: 'pending', checkedAt: new Date() } } });
    try {
      const { data } = await axios.post(
        config.kycVerify.url,
        {
          reference: userId,
          name: user.name,
          dateOfBirth: user.dateOfBirth,
          phone: user.phone,
          licenceNumber: user.kyc?.licenseNumber,
          registrationNumber: vehicle?.plateNumber,
          callbackUrl: `${config.app.baseUrl.replace(/\/$/, '')}/kyc-verify/callback`,
        },
        { timeout: 20_000, headers: config.kycVerify.apiKey ? { Authorization: `Bearer ${config.kycVerify.apiKey}` } : {} },
      );
      await this.recordVendorAnswer(userId, data);
    } catch (error) {
      logger.error('Background check request failed', { userId, error: (error as Error).message });
      await User.updateOne({ _id: userId }, { $set: { 'kyc.backgroundCheck': { status: 'error', summary: 'The vendor could not be reached; check by hand.', checkedAt: new Date() } } });
    }
  }

  async recordVendorAnswer(userId: string, data: { status?: string; reference?: string; summary?: string }): Promise<void> {
    const status = ['clear', 'consider', 'pending'].includes(String(data?.status)) ? String(data.status) : 'error';
    await User.updateOne(
      { _id: userId },
      { $set: { 'kyc.backgroundCheck': { status, reference: data?.reference ? String(data.reference).slice(0, 100) : undefined, summary: data?.summary ? String(data.summary).slice(0, 1000) : undefined, checkedAt: new Date() } } },
    );
  }
}
