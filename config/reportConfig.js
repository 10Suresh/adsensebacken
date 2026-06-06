// config.js

const REPORT_CONFIG = {
  adsense: {
    metrics: [
      "ESTIMATED_EARNINGS",
      "CLICKS",
      "PAGE_VIEWS",
      "IMPRESSIONS",
      "PAGE_VIEWS_CTR",
      "COST_PER_CLICK",
      "PAGE_VIEWS_RPM"
    ],
    dimensions: ["DATE", "DOMAIN_NAME", "COUNTRY_NAME"]
  },
};

module.exports = REPORT_CONFIG;
