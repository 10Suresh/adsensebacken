const mongoose = require("mongoose");

const adsenseAccountSchema = new mongoose.Schema({
  googleId: { type: String, required: true },
  email: { type: String, required: true },
  accountId: { type: String },
  displayName: { type: String },
  accessToken: { type: String },
  refreshToken: { type: String },
}, { _id: false }); // 👈 extra _id avoid karne ke liye


// Ad Manager Account Sub-Schema
const adManagerAccountSchema = new mongoose.Schema({
  googleId: { type: String, required: true },
  email: { type: String, required: true },
  networkId: { type: String }, // Ad Manager specific
  displayName: { type: String },
  accessToken: { type: String },
  refreshToken: { type: String },
  sites: [
    {
      id: String,
      url: String,
      approvalStatus: String,
      childNetworkCode: String,
    }
  ]
}, { _id: false });
const userSchema = new mongoose.Schema(
  {
    fname: { type: String },
    lname: { type: String },
    email: { type: String, required: true, unique: true }, // admin ke liye unique
    password: { type: String },

    // Multiple AdSense accounts
    adsenseAccounts: [adsenseAccountSchema],

    // Multiple Ad Manager accounts
    adManagerAccounts: [adManagerAccountSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
