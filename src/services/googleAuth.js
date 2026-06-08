const { google } = require("googleapis");
const User = require("../models/User");
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL, APP_NAME } = require("../../config/config")
const AdsenseSiteSchema = require("../models/Sites");
const soap = require("soap");
async function getAuthorizedClient(userId, accountId) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    // Find the correct AdSense account
    const account = user.adsenseAccounts.find(
        (acc) => acc.accountId === accountId
    );
    if (!account) throw new Error("AdSense account not linked");

    const oauth2Client = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_CALLBACK_URL
    );

    oauth2Client.setCredentials({
        access_token: account.accessToken,
        refresh_token: account.refreshToken,
    });

    // Auto-refresh tokens and update DB
    oauth2Client.on("tokens", async (tokens) => {
        if (tokens.access_token) {
            account.accessToken = tokens.access_token;
        }
        if (tokens.refresh_token) {
            account.refreshToken = tokens.refresh_token;
        }
        await user.save();
    });

    return oauth2Client;
}
async function fetchAndSaveSites(userId, accountId) {
    try {
        const auth = await getAuthorizedClient(userId, accountId);
        const adsense = google.adsense("v2");

        const siteList = await adsense.accounts.sites.list({
            parent: `accounts/${accountId}`,
            auth,
        });

        const sites = siteList.data.sites || [];
        const defaultSites = await AdsenseSiteSchema.find({
            userId,
            accountId,
            state: { $exists: false }
        });

        if (defaultSites.length > 0) {
            await AdsenseSiteSchema.deleteMany({
                userId,
                accountId,
                state: { $exists: false }
            });
        }


        const readySites = sites.filter(site => site.state === "READY");

        // ✅ 3) Insert/Update only READY sites
        for (const site of readySites) {
            await AdsenseSiteSchema.findOneAndUpdate(
                { userId, accountId, name: site.name },
                {
                    userId,
                    accountId,
                    name: site.name,
                    domain: site.domain,
                    state: site.state,
                    autoAdsEnabled: site.autoAdsEnabled,
                },
                { upsert: true, new: true }
            );
        }

        return readySites;

    } catch (err) {
        console.error("Error fetching AdSense sites:", err.message);
        throw err;
    }
}



async function getFreshAccessToken(accessToken, refreshToken) {
    const oauth2Client = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_CALLBACK_URL
    );

    oauth2Client.setCredentials({
        refresh_token: refreshToken, // 👈 main thing
    });

    try {
        const { credentials } = await oauth2Client.refreshAccessToken(); // ⚠️ refresh explicitly
        if (!credentials?.access_token) {
            throw new Error("Could not refresh Google access token.");
        }
        return credentials.access_token;
    } catch (err) {
        console.error(
            " Failed to refresh access token:",
            err.response?.data || err.message
        );
        throw err;
    }
}
async function fetchAdManagerNetworkId(accessToken, refreshToken) {
    // always use a fresh, valid token for the SOAP call
    const bearer = await getFreshAccessToken(accessToken, refreshToken);

    const WSDL =
        "https://ads.google.com/apis/ads/publisher/v202505/NetworkService?wsdl";
    const client = await soap.createClientAsync(WSDL);

    // REQUIRED: OAuth2 goes in HTTP header
    client.addHttpHeader("Authorization", `Bearer ${bearer}`);

    // Minimal SOAP RequestHeader with proper namespace (NO oauth fields here)
    const NS = "https://www.google.com/apis/ads/publisher/v202505";
    const headerXml = `
    <tns:RequestHeader xmlns:tns="${NS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <tns:networkCode xsi:nil="true"></tns:networkCode>
      <tns:applicationName>${APP_NAME || "Ads Dashboard"}</tns:applicationName>
    </tns:RequestHeader>
  `;
    client.addSoapHeader(headerXml);

    try {
        // node-soap returns [result, rawResponse, soapHeader, rawRequest]
        const [result] = await client.getAllNetworksAsync({});
        const rval = result?.rval || [];
        if (!Array.isArray(rval) || rval.length === 0) {
            throw new Error("No Ad Manager networks visible to this user.");
        }
        const { networkCode, displayName, networkId } = rval[0];
        return networkCode;
    } catch (err) {
        // Surface a helpful message for 401s
        const status = err?.response?.status;
        if (status === 401) {
            throw new Error(
                "Unauthorized (401) from Ad Manager. Check: 1) Admin → Global settings → API access is enabled, " +
                "2) your OAuth2 Client ID is allowed there, 3) the signed-in Google user actually has an Ad Manager network."
            );
        }
        throw err;
    }
}
async function fetchDomainsFromNetwork(userId, networkCode, accessToken, refreshToken) {
    const bearer = await getFreshAccessToken(accessToken, refreshToken);
    const WSDL =
        "https://ads.google.com/apis/ads/publisher/v202508/SiteService?wsdl";
    const client = await soap.createClientAsync(WSDL);
    client.addHttpHeader("Authorization", `Bearer ${bearer}`);

    const NS = "https://www.google.com/apis/ads/publisher/v202508";
    client.addSoapHeader(`
    <tns:RequestHeader xmlns:tns="${NS}">
      <tns:networkCode>${networkCode}</tns:networkCode>
      <tns:applicationName>DashboardApp</tns:applicationName>
    </tns:RequestHeader>
  `);

    // PQL to fetch all sites (can add WHERE clause if needed)
    const statement = {
        filterStatement: {
            query: "LIMIT 500", // you can change the limit or use paging if needed
        },
    };

    const [result] = await client.getSitesByStatementAsync(statement);
    const sites = result?.rval?.results || [];
    const domains = sites.map((site) => ({
        id: site.id,
        url: site.url,
        approvalStatus: site.approvalStatus,
        childNetworkCode: site.childNetworkCode,
    }));

    const user = await User.findOne({
        _id: userId,
        "adManagerAccounts.networkId": networkCode,
    });

    if (!user) {
        throw new Error(` User with networkId ${networkCode} not found`);
    }
    const adAccount = user.adManagerAccounts.find(
        (acc) => acc.networkId === networkCode
    );
    if (!adAccount) {
        throw new Error(" Ad Manager account not found inside user");
    }
    adAccount.sites = domains;
    await user.save();
    return domains;
}
async function saveAdManagerAccount(user, profile, accessToken, refreshToken) {
    let networkId = null;
    try {
        networkId = await fetchAdManagerNetworkId(accessToken, refreshToken);
    } catch (err) {
        console.error("Failed to fetch networkId:", err.message);
    }

    const existing = user.adManagerAccounts.find(
        (acc) => acc.googleId === profile.id
    );
    if (existing) {
        existing.accessToken = accessToken;
        existing.refreshToken = refreshToken;
        existing.displayName = profile.displayName || existing.displayName;
        existing.networkId = networkId || existing.networkId || null;
    } else {
        user.adManagerAccounts.push({
            googleId: profile.id,
            email: profile.emails?.[0]?.value || "",
            displayName: profile.displayName || "",
            accessToken,
            refreshToken,
            networkId,
        });
    }
    await user.save();
    return networkId || profile.id;
}
async function saveAdsenseAccount(user, profile, accessToken, refreshToken) {
    const oauth2Client = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_CALLBACK_URL
    );
    oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
    });

    // Fetch AdSense accounts
    const adsense = google.adsense("v2");
    const accRes = await adsense.accounts.list({ auth: oauth2Client });
    const googleAccount = accRes.data.accounts?.[0];
    if (!googleAccount) throw new Error("No AdSense account found");

    const accountId = googleAccount.name.split("/")[1];

    //  Safe displayName (prefer API displayName, else profile.name, else email)
    const safeDisplayName =
        googleAccount.displayName && !googleAccount.displayName.startsWith("pub-")
            ? googleAccount.displayName
            : profile.displayName || profile.emails?.[0]?.value || accountId;
    //  Update or push into DB
    let acc = user.adsenseAccounts.find((a) => a.googleId === profile.id);
    if (!acc) {
        user.adsenseAccounts.push({
            googleId: profile.id,
            accountId,
            email: profile.emails?.[0]?.value,
            displayName: safeDisplayName,
            accessToken,
            refreshToken,
        });
    } else {
        acc.accountId = accountId;
        acc.displayName = safeDisplayName; // update too
        acc.accessToken = accessToken;
        if (refreshToken) acc.refreshToken = refreshToken;
    }

    await user.save();
    return accountId;
}
module.exports = {
    getAuthorizedClient, fetchAndSaveSites, fetchAdManagerNetworkId,
    getFreshAccessToken, fetchDomainsFromNetwork, saveAdManagerAccount, saveAdsenseAccount
};
