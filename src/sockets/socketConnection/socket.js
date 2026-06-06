let io;
const authSocketMiddleware = require("../../middleware/RSocket.js");
const { allowedOrigins } = require("../../../config/corsConfig.js");

module.exports = {
  init: (server) => {
    io = require("socket.io")(server, {
      pingTimeout: 1200000,
      pingInterval: 3000,
      perMessageDeflate: true,
      cors: {
        origin: allowedOrigins,
        credentials: true
      },
    });
    io.use(authSocketMiddleware);

    return io;
  },
  get: () => {
    if (!io) {
      throw new Error("Socket.io not initialized!");
    }
    return io;
  },
};
