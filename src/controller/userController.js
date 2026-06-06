const User = require("../models/User");
const jwt = require("jsonwebtoken");
const logger = require("../logger"); // ✅ use logger
const { JWT_SECRET, FRONTEND_REDIRECT_URL } = require("../../config/config");
const passport = require("passport");
const {

  fetchAdManagerReport,
  fetchAndSaveReport2,
} = require("../../utils/googleClient");
const { fetchAndSaveSites, saveAdsenseAccount, saveAdManagerAccount, fetchDomainsFromNetwork } = require("../../src/services/googleAuth")
// 🔹 Fetch AdSense accounts
const getAdsenseAccounts = async (req, res) => {
  try {
    res.json({ accounts: req.user.adsenseAccounts });
    logger.info(`Fetched AdSense accounts for user: ${req.user._id}`);
  } catch (err) {
    logger.error(`Error fetching AdSense accounts: ${err.message}`, { stack: err.stack });
    res.status(500).json({ msg: "Server error" });
  }
};

// 🔹 Google Auth
const googleAuth = (req, res, next) => {
  const token = req.query.state;
  if (!token) {
    logger.warn("Missing state (JWT) in googleAuth request");
    return res.status(400).json({ msg: "Missing state (JWT)" });
  }

  passport.authenticate("google", {
    scope: [
      "https://www.googleapis.com/auth/adsense.readonly",
      "https://www.googleapis.com/auth/dfp",
      "email",
      "profile",
    ],
    accessType: "offline",
    prompt: "consent",
    state: token,
    session: false,
  })(req, res, next);
};

// 🔹 Google Callback
const googleCallback = [
  passport.authenticate("google", { session: false, failureRedirect: "/" }),
  async (req, res) => {
    const startTime = Date.now();
    try {
      const { profile, accessToken, refreshToken } = req.authInfo;
      const decoded = jwt.verify(req.query.state, JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
        logger.warn(`User not found during Google callback: ${decoded.id}`);
        return res.status(404).json({ msg: "User not found" });
      }

      let adsenseAccountId = null;
      let adManagerAccountId = null;
      // Run AdSense + Ad Manager tasks in parallel
      const [adsenseResult, adManagerResult] = await Promise.allSettled([
        (async () => {
          try {
            const accountId = await saveAdsenseAccount(
              user, profile, accessToken, refreshToken
            );
            if (!accountId) return null;

            await Promise.all([
              fetchAndSaveReport2(decoded.id, accountId),
              fetchAndSaveSites(decoded.id, accountId),
            ]);

            logger.info(`AdSense account saved for user ${user._id}: ${accountId}`);
            return accountId;
          } catch (e) {
            logger.error(`AdSense save failed for user ${user._id}: ${e.message}`);
            return null;
          }
        })(),
        (async () => {
          try {
            const finalRefreshToken =
              refreshToken || user.adManagerAccounts?.[0]?.refreshToken || null;

            const accountId = await saveAdManagerAccount(
              user, profile, accessToken, finalRefreshToken
            );
            if (!accountId) return null;

            await Promise.all([
              fetchDomainsFromNetwork(user._id, accountId, accessToken, finalRefreshToken),
              fetchAdManagerReport(decoded.id, accountId, accessToken, finalRefreshToken),
            ]);

            logger.info(`Ad Manager account saved for user ${user._id}: ${accountId}`);
            return accountId;
          } catch (e) {
            logger.error(`Ad Manager save failed for user ${user._id}: ${e.message}`);
            return null;
          }
        })(),
      ]);

      // Collect results
      if (adsenseResult.status === "fulfilled")
        adsenseAccountId = adsenseResult.value;
      if (adManagerResult.status === "fulfilled")
        adManagerAccountId = adManagerResult.value;

      let redirectUrl = `${FRONTEND_REDIRECT_URL}/dashboard?connected=1`;
      if (adsenseAccountId)
        redirectUrl += `&adsenseAccount=${adsenseAccountId}`;
      if (adManagerAccountId)
        redirectUrl += `&adManagerAccount=${adManagerAccountId}`;

      return res.redirect(redirectUrl);
    } catch (err) {
      logger.error(`Google Callback Error: ${err.message}`, { stack: err.stack });
      return res.redirect(`${FRONTEND_REDIRECT_URL}/dashboard?error=1`);
    }
  },
];

module.exports = {
  getAdsenseAccounts,
  googleAuth,
  googleCallback,
};
