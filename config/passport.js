const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const jwt = require("jsonwebtoken");
const User = require("../src/models/User");
const { google } = require("googleapis");
const { JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL } = require("./config")
passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
    },

    // ✅ Google callback hit after successful login
    async (req, accessToken, refreshToken, profile, done) => {

      try {
        const token = req.query.state;
        const decoded = jwt.verify(token, JWT_SECRET);
        let user = await User.findById(decoded.id);
        if (!user) {
          console.error("❌ User not found with ID:", decoded.id);
          return done(new Error("User not found"), null);
        }

     
        return done(null, user, { profile, accessToken, refreshToken });

      } catch (err) {
        console.error("🚨 Error in Google Strategy callback:", err.message);
        return done(err, null);
      }
    }
  )
);

// ✅ Serialize User
passport.serializeUser((user, done) => {
  console.log("💾 Serializing user:", user.id);
  done(null, user.id);
});

// ✅ Deserialize User
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    console.log("📥 Deserialized user:", user?.email || "Not found");
    done(null, user);
  } catch (err) {
    console.error("❌ Deserialization error:", err.message);
    done(err, null);
  }
});

module.exports = passport;
