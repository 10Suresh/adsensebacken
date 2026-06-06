const { redisClient } = require("../session");

const handleConnection = async (socket, io) => {
  const userId = socket.user.id;

  console.log(` User ${userId} connected with socket ${socket.id}`);

  // cleanup on disconnect
  socket.on("disconnect", async (reason) => {
    console.log(`User ${userId} disconnected (${reason})`);
    await redisClient.del(userId);
  });

  // check if user already had a socket
  const previousSocketId = await redisClient.get(userId);
  if (previousSocketId && previousSocketId !== socket.id) {
    const previousSocket = io.sockets.sockets.get(previousSocketId);

    if (previousSocket) {
      console.log(` Disconnecting old socket for user ${userId}: ${previousSocketId}`);
      previousSocket.disconnect(true);
      await redisClient.del(userId);
    }
  }

  // save new socket with TTL
  await redisClient.set(userId, socket.id, { EX: 60 * 60 });
};

module.exports = handleConnection;
