const AdsenseRowSchema = require("../../models/AdsenseRowSchema");

async function getAdsenseDashboardSites(user) {
  const userId = user._id;
  const accountIds = (user.adsenseAccounts || []).map((acc) => acc.accountId);

  const listAggregation = await AdsenseRowSchema.aggregate([
    { $match: { userId, accountId: { $in: accountIds } } },
    {
      $group: {
        _id: null,
        allCountries: { $addToSet: "$country" },
        allDomains: {
          $addToSet: {
            domain: "$domain",
            accountId: "$accountId",   // ✅ ADD accountId
            isAdsense: true            // ✅ Keep flag
          }
        }
      }
    }
  ]);

  const data = listAggregation[0] || { allDomains: [], allCountries: [] };

  return {
    accountIds,
    allAdsenseCountries: data.allCountries.sort(),
    allAdsenseDomains: data.allDomains.sort((a, b) => a.domain.localeCompare(b.domain))
  };
}

module.exports = { getAdsenseDashboardSites };
