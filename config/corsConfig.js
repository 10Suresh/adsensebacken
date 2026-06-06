const allowedOrigins = [
  "http://localhost:5173",
  "https://finance.rudzen.com"
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS: " + origin));
    }
  },
  credentials: true
};

module.exports = { allowedOrigins, corsOptions };
