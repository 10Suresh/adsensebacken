const logger = require("../logger");
const Website = require("../models/Website");
const { clearUserCache } = require("../redis/cache");
const mongoose = require("mongoose")
//  Add Website

const addWebsite = async (req, res) => {
  try {
    const { name, isAdsense, networkId, accountId } = req.body;

    if (!name) {
      return res.status(400).json({ message: "URL is required" });
    }

    const userId = req.user._id;

    // ✅ Build dynamic query:
    const query = { url: name, userId };

    if (isAdsense) {
      if (!accountId) {
        return res.status(400).json({ message: "accountId is required for Adsense website" });
      }
      query.accountId = accountId;
    } else {
      if (!networkId) {
        return res.status(400).json({ message: "networkId is required for non-Adsense website" });
      }
      query.networkId = networkId;
    }

    // ✅ Check duplicate
    const existingWebsite = await Website.findOne(query);
    if (existingWebsite) {
      return res.status(400).json({
        message: "❌ Website already exists for this user with same account/network",
      });
    }

    // ✅ Create and save
    const newWebsite = new Website({
      url: name,
      userId,
      isAdsense,
      networkId: isAdsense ? null : networkId,
      accountId: isAdsense ? accountId : null,
    });

    await newWebsite.save();

    return res.status(201).json({
      message: "✅ Website added successfully",
      website: newWebsite,
    });

  } catch (err) {
    console.error("Add Website Error:", err);
    return res.status(500).json({ message: "❌ Server error" });
  }
};


// Get Websites
const getWebsites = async (req, res) => {
  try {
    const userId = req.user._id;
    const websites = await Website.find({ userId });

    return res.status(200).json(websites);
  } catch (err) {
    logger.error("Get Websites Error:", err.message);
    return res.status(500).json({ message: " Server error" });
  }
};

//  Delete Website
const deleteWebsite = async (req, res) => {
  try {
    const { id } = req.params;
    const websiteId = new mongoose.Types.ObjectId(id);
    const userId = req.user._id;
    const deletedWebsite = await Website.findOneAndDelete({
      _id: websiteId,
      userId: userId,
    });

    if (!deletedWebsite) {
      return res.status(404).json({ message: " Website not found" });
    }
    clearUserCache(userId);
    return res.status(200).json({ message: " Website deleted successfully" });
  } catch (err) {
    console.log(err);
    logger.error("Delete Website Error:", err.message);
    return res.status(500).json({ message: " Server error" });
  }
};

module.exports = { addWebsite, getWebsites, deleteWebsite };
