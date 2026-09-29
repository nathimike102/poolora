/**
 * DocumentCheckService.ts
 *
 * Automatic checks on a driver application (UC-A01 step 3), run when it
 * arrives and again on request. They help the admin; they never approve or
 * reject on their own.
 *
 * Checked here, with no outside service:
 * - the licence number looks like one (VID licences carry no issue year or
 *   province, so this is a sanity check; the admin compares it with the photo)
 * - the plate is in the Zimbabwe ABC 1234 format (older and personalised
 *   plates are flagged for a look, not failed)
 * - the driver is at least 18
 * - no other account uses the same licence number or plate
 * - the vehicle is under 15 years old (older cars are flagged for a
 *   roadworthiness look, since much of the fleet here is imported used)
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

const clean = (s?: string) => String(s ?? '').toUpperCase().replace(/[\s\-/]/g, '');

/** 5 to 12 letters and digits, with at least one digit */
export function parseLicence(number?: string): { number: string } | null {
  const n = clean(number);
  return /^[A-Z0-9]{5,12}$/.test(n) && /\d/.test(n) ? { number: n } : null;
}

/**
 * The current Zimbabwe plate is three letters and four digits (AEA 1234).
 * Anything else of plate length is "other": older series and personalised
 * plates are legal, so they are flagged rather than failed.
 */
export function parsePlate(plate?: string): { standard: boolean } | null {
  const p = clean(plate);
  if (/^[A-Z]{3}\d{4}$/.test(p)) return { standard: true };
  return /^[A-Z0-9]{2,8}$/.test(p) ? { standard: false } : null;
}

const MIN_DRIVER_AGE = 18;

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
    out.push(licence
      ? { check: 'Licence number format', result: 'pass', detail: 'Looks like a licence number. Compare it with the licence photo.' }
      : { check: 'Licence number format', result: 'fail', detail: `"${user.kyc?.licenseNumber ?? ''}" does not look like a driving licence number.` });

    if (user.dateOfBirth) {
      const born = new Date(user.dateOfBirth);
      const age = now.getFullYear() - born.getFullYear() - (now < new Date(now.getFullYear(), born.getMonth(), born.getDate()) ? 1 : 0);
      out.push(age < MIN_DRIVER_AGE
        ? { check: 'Driver age', result: 'fail', detail: `The driver is ${age}; drivers must be at least ${MIN_DRIVER_AGE}.` }
        : { check: 'Driver age', result: 'pass', detail: `${age} years old.` });
    } else {
      out.push({ check: 'Driver age', result: 'warn', detail: 'No date of birth on the profile.' });
    }

    const plate = parsePlate(vehicle?.plateNumber);
    if (!plate) out.push({ check: 'Registration number format', result: 'fail', detail: `"${vehicle?.plateNumber ?? ''}" is not a valid registration number.` });
    else if (!plate.standard) out.push({ check: 'Registration number format', result: 'warn', detail: 'Not the usual ABC 1234 format. Older and personalised plates exist; check the registration book.' });
    else out.push({ check: 'Registration number format', result: 'pass', detail: 'Standard Zimbabwe plate.' });

    if (user.kyc?.licenseNumber) {
      const others = await User.find({ _id: { $ne: user._id }, 'kyc.licenseNumber': user.kyc.licenseNumber }).select('name').limit(3).lean();
      out.push(others.length
        ? { check: 'Licence used elsewhere', result: 'fail', detail: `The same licence number is on ${others.map((o) => o.name).join(', ')}.` }
        : { check: 'Licence used elsewhere', result: 'pass', detail: 'No other account uses this licence.' });
    }
    if (vehicle?.plateNumber) {
      const others = await User.find({ _id: { $ne: user._id }, 'vehicles.plateNumber': vehicle.plateNumber, 'kyc.status': 'approved' }).select('name').limit(3).lean();
      out.push(others.length
        ? { check: 'Vehicle used elsewhere', result: 'warn', detail: `An approved driver (${others.map((o) => o.name).join(', ')}) has the same plate. Shared family cars are fine; check the owner in the registration book.` }
        : { check: 'Vehicle used elsewhere', result: 'pass', detail: 'No approved driver has this plate.' });
    }

    if (vehicle?.year) {
      const age = now.getFullYear() - vehicle.year;
      out.push(age >= 15
        ? { check: 'Vehicle age', result: 'warn', detail: `${age} years old. Check the ZINARA licence disc is current and the car is roadworthy.` }
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
