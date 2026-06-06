const AdManagerRowsSchema = require("../../models/AdManagerRowsSchema");

async function getAdManagerDashboardSites(user) {
  const userId = user._id;

  // ✅ Get networkIds from user
  const networkIds = (user.adManagerAccounts || [])
    .map(acc => String(acc.networkId))
    .filter(Boolean);

  // ✅ Aggregate data
  const result = await AdManagerRowsSchema.aggregate([
    {
      $match: {
        userId,
        networkId: { $in: networkIds }
      }
    },
    {
      $group: {
        _id: null,
        allCountries: { $addToSet: "$country" },
        allSites: {
          $addToSet: {
            site: "$site",
            networkId: "$networkId",
            isAdsense: false   // ✅ Mark as AdManager (not Adsense)
          }
        }
      }
    }
  ]);

  // ✅ If no result, return default values
  const data = result[0] || { allSites: [], allCountries: [] };

  // ✅ Sort sites alphabetically
  const allAdManagerSites = (data.allSites || []).sort((a, b) =>
    a.site.localeCompare(b.site)
  );

  // ✅ Sort countries alphabetically
  const allAdManagerCountries = (data.allCountries || []).sort();

  return {
    allAdManagerCountries,
    allAdManagerSites,
    networkIds
  };
}

module.exports = { getAdManagerDashboardSites };
