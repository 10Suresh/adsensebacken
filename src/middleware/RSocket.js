const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../../config/config")

const authSocketMiddleware = async (socket, next) => {
    const token = socket.handshake.auth?.token;
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.user = decoded;
    } catch (err) {
        return next(new Error("NOT AUTHORIZED"));
    }

    next();
};

module.exports = authSocketMiddleware;