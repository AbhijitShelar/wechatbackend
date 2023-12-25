const mongoose = require("mongoose");
const dotenv = require("dotenv");
const socketIO = require("socket.io");
const cors = require("cors");

dotenv.config();

mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => console.log("MongoDB Connection Successful"))
  .catch((error) => console.error("MongoDB Connection Error:", error));

const User = new mongoose.model("User", {
  userId: String,
  name:String,
  socketId: String,
});

const ChatHistory=new mongoose.model("chathistory",{
  senderId:String,
  senderName:String,
  recipientId:String,
  recipientName:String,
  message:String,
  timestamp:String
});


const handleUserJoined = async (io, socket, userData) => {
  try {
    const { userId ,name} = userData;
    let user = await User.findOne({ userId });
    console.log("User joined",name)
    if (!user) {
      user = new User({ userId,name, socketId: socket.id });
      await user.save();
    } else {
      user.socketId = socket.id;
      await user.save();
    }

    io.emit("user-joined", userData);
    io.emit("updateList");
  } catch (error) {
    if (error.name === 'DocumentNotFoundError') {
      console.log(`User not found for userId: ${userData.userId}`);
    } else {
      console.error("Error handling user-joined event:", error);
    }
  }
};

const handleSendMessage = async (io, socket, data) => {
  console.log("Server received a message:", data);

  const { message, messageSenderName, messageSenderId, messageRecipientId ,messageRecipientName,attach,timestamp} = data;

  try {
    const recipient = await User.findOne({ userId: messageRecipientId });
    let chathistory=new ChatHistory({senderId:messageSenderId,recipientId:recipient.userId,message})
    await chathistory.save();
    console.log("hlo", recipient);

    if (recipient && recipient.socketId) {
      io.to(recipient.socketId).emit("receive", { message, messageSenderName ,messageSenderId, messageRecipientId,messageRecipientName,attach,timestamp});
    } else {
      console.log("Invalid user or user not online");
    }
  } catch (err) {
    console.error("Error finding recipient:", err);
  }
};

const handleDisconnect = async (io, socket) => {
  try {

    const user = await User.findOne({ socketId: socket.id });

    if (user) {
      user.socketId = null;
      await user.save();
      console.log(`User disconnected: ${user.userId}`);
      io.emit("updateList")

    } else {
      console.log("User not found in the database");
    }
  } catch (error) {
    console.error("Error handling disconnect event:", error);
  }
};


const initializeSocket = (server) => {
  const io = socketIO(server, {
    cors: {
      origin: '*',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
      optionsSuccessStatus: 204,
    },
  });

  io.on("connection", (socket) => {
    console.log("A user connected");

    socket.on("connect", () => {
      console.log("User connected:", socket.id);
    });

    socket.on("user-joined", (userData) =>
      handleUserJoined(io, socket, userData)
    );

    socket.on("send", (data) => handleSendMessage(io, socket, data));

    socket.on("disconnect", () => handleDisconnect(io, socket));
  });

  return io;
};

module.exports = {initializeSocket,User};
