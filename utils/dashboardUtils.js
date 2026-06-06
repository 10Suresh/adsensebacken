// utils/dashboardUtils.js

/**
 * Merge Adsense and AdManager sites into a single array and sort them.
 * @param {Object} adsenseData - { allAdsenseDomains: [{domain: string}] }
 * @param {Object} adManagerData - { allAdManagerSites: [{site: string}] }
 * @param {string} sortKey - key to sort by ("name" by default)
 * @param {string} sortDirection - "asc" or "desc"
 * @returns {Array} merged and sorted sites
 */
function mergeSites(adsenseData, adManagerData) {
  const merged = [
    ...(adsenseData?.allAdsenseDomains || []).map((item) => ({
      name: item.domain,
      accountId: item.accountId,   // ✅ Adsense accountId
      isAdsense: true,
    })),
    ...(adManagerData?.allAdManagerSites || []).map((item) => ({
      name: item.site,
      networkId: item.networkId,   // ✅ AdManager networkId
      isAdsense: false,
    })),
  ];

  return merged.sort((a, b) => {
  //   const valA = a[sortKey];
  //   const valB = b[sortKey];

  //   if (typeof valA === "string" && typeof valB === "string") {
  //     return sortDirection === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
  //   }
  //   if (typeof valA === "number" && typeof valB === "number") {
  //     return sortDirection === "asc" ? valA - valB : valB - valA;
  //   }
    return 0;
  });
}

/**
 * Parse nested query filters like adsenseFilter[domain][0] => { domain: ["example.com"] }
 * @param {Object} query - req.query object
 * @param {string} prefix - filter prefix e.g., "adsenseFilter"
 * @returns {Object} parsed filter
 */
function parseNestedFilter(query, prefix) {
  const filter = {};

  Object.entries(query).forEach(([key, value]) => {
    if (!key.startsWith(prefix)) return;

    // Remove prefix and brackets
    const subKey = key.replace(`${prefix}[`, "").replace("]", "");

    if (subKey.includes("[")) {
      // handle array keys: domain[0]
      const arrayKey = subKey.replace(/\[\d+\]/, "");
      filter[arrayKey] = filter[arrayKey] || [];
      filter[arrayKey].push(value);
    } else {
      filter[subKey] = value;
    }
  });

  return filter;
}

module.exports = { mergeSites, parseNestedFilter };
