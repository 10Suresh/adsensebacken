const mongoose = require("mongoose");

const AdsenseRowSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    accountId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    domain: { type: String, required: true, index: true },
    country: { type: String, index: true },

    metrics: {
      estimatedEarnings: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      pageViews: { type: Number, default: 0 },
      impressions: { type: Number, default: 0 },
      ctr: { type: Number, default: 0 },
      cpc: { type: Number, default: 0 },
      rpm:{type: Number, default: 0 }
    },

    fetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// ✅ Compound indexes for fast filtering
AdsenseRowSchema.index({ userId: 1, accountId: 1, date: 1 });
AdsenseRowSchema.index({ userId: 1, accountId: 1, country: 1 });
AdsenseRowSchema.index({ userId: 1, accountId: 1, domain: 1 });

// ✅ Unique key prevents duplicate rows
AdsenseRowSchema.index(
  { userId: 1, accountId: 1, date: 1, domain: 1, country: 1 },
  { unique: true }
);

module.exports = mongoose.model("AdsenseRow", AdsenseRowSchema);
