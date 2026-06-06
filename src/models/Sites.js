const mongoose = require("mongoose");

const AdsenseSiteSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    accountId: { type: String, required: true },
    name: String,
    domain: String,
    state: String,
    autoAdsEnabled: Boolean,
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdsenseSite", AdsenseSiteSchema);
