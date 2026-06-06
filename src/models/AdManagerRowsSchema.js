const mongoose = require("mongoose");

const AdManagerRowsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    networkId: { type: String, required: true, index: true },
    reportJobId: { type: Number },

    reportDate: { type: String, required: true, index: true }, // YYYY-MM-DD
    site: { type: String, required: true, index: true },
    country: { type: String, required: true, index: true },

    // store in actual $ units, not micros
    adxExchangeLineItemLevelImpressions: { type: Number, default: 0 },
    adxExchangeLineItemLevelClicks: { type: Number, default: 0 },
    adxExchangeLineItemLevelRevenue: { type: Number, default: 0 }, // already divided by 1,000,000 at ingest time
    adxExchangeLineItemLevelAverageECPM: { type: Number, default: 0 },
    adxExchangeLineItemLevelCtr: { type: Number, default: 0 },
    adxExchangeCostPerClick: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// ✅ Unique row per user+network+date+site+country
AdManagerRowsSchema.index(
  { userId: 1, networkId: 1, reportDate: 1, site: 1, country: 1 },
  { unique: true }
);

// ✅ Fast lookup indexes
AdManagerRowsSchema.index({ userId: 1, networkId: 1, reportDate: 1 });
AdManagerRowsSchema.index({ userId: 1, networkId: 1, country: 1 });
AdManagerRowsSchema.index({ userId: 1, networkId: 1, site: 1 });

module.exports = mongoose.model("AdManagerRow", AdManagerRowsSchema);
