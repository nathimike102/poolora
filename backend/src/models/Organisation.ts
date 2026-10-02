import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * A company whose staff pool rides to work (UC-C01). Staff join by
 * confirming an email address on one of its domains (UC-C02). The company's
 * share of fares and its monthly bill come in later slices.
 */
export interface IOrganisation extends Document {
  _id: Types.ObjectId;
  name: string;
  /** Email domains its staff use, lower case, e.g. "econet.co.zw" */
  domains: string[];
  billingContact: { name: string; email: string; phone?: string };
  /** A suspended programme keeps its members, but they get none of its benefits */
  status: 'active' | 'suspended';
  /** Contract notes for admins; never shown to members */
  notes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OrganisationSchema = new Schema<IOrganisation>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    domains: {
      type: [{ type: String, lowercase: true, trim: true }],
      validate: { validator: (v: string[]) => v.length >= 1 && v.length <= 10, message: 'Between 1 and 10 email domains' },
    },
    billingContact: {
      name: { type: String, required: true, trim: true, maxlength: 100 },
      email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
      phone: { type: String, trim: true },
    },
    status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
    notes: { type: String, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    toJSON: { transform(_doc, ret) { delete (ret as Record<string, unknown>).__v; return ret; } },
  },
);

// One company per domain: staff of two companies must never land in the wrong one
OrganisationSchema.index({ domains: 1 }, { unique: true });

export const Organisation = mongoose.model<IOrganisation>('Organisation', OrganisationSchema);
