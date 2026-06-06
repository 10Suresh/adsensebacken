const mongoose = require("mongoose");

const WebsiteSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isAdsense: {
      type: Boolean,
      default: false,
    },

    // ✅ For Adsense websites
    accountId: {
      type: String,
      default: null,
    },

    // ✅ For other ad networks
    networkId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

/**
 * ✅ UNIQUE COMPOUND INDEXES
 * - Same user cannot add same URL with same accountId
 * - Same user cannot add same URL with same networkId
 */
WebsiteSchema.index(
  { url: 1, userId: 1, accountId: 1 },
  { unique: true, partialFilterExpression: { accountId: { $ne: null } } }
);

WebsiteSchema.index(
  { url: 1, userId: 1, networkId: 1 },
  { unique: true, partialFilterExpression: { networkId: { $ne: null } } }
);

module.exports = mongoose.model("Website", WebsiteSchema);
