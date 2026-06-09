
const { PORT } = require("../config/config")
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const { corsOptions } = require("../config/corsConfig");
// Local imports
const { options } = require("./session");
const connectDB = require("../config/db");
require("../config/passport");
// require("./queues/reportQueue");
const socket = require("../src/sockets/socketConnection/socket");
const handleConnection = require("./sockets/socketHandler");
// Routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/userRoutes");
const websiteRoutes = require("./routes/websiteRoutes");
const adsenseRoutes = require("./routes/adsense");
const adManagerRoutes = require("./routes/adManager");
const adsenseOfflineRoutes = require("./routes/adsenseOfflineRoutes");

// ========================
// App Setup
// ========================
const app = express();


// ========================
// Middleware
// ========================

app.use(cors(corsOptions));
app.use(express.json());
app.set("trust proxy", 1);

app.use(session(options));
app.use(passport.initialize());
app.use(passport.session());

// ========================
// Routes
// ========================
app.get("/", (req, res) => res.send("Hello World 🚀"));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/web", websiteRoutes);
app.use("/api/adsense", adsenseRoutes);
app.use("/api/adsense/offline", adsenseOfflineRoutes);
app.use("/api/admanager", adManagerRoutes);

// ========================
// Error Handler
// ========================
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${err.stack}`);
  res.status(500).json({ message: "Something went wrong!" });
});

// ========================
// Start Server
// ========================
const { initCrons } = require("./cron/reportCron");

connectDB().then(() => {
  initCrons();

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });

  // ✅ init socket with server
  const io = socket.init(server);

  io.on("connection", (sock) => {
    handleConnection(sock, io);
  });
});