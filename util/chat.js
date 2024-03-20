const Chat = require("../model/chat");
const ChatRoom = require("../model/chatroom")

const error = require("./error-handling/errorHandler");

module.exports = {
  getChat: async (chatId) => {
    const chat = await Chat.findById(chatId);

    if (!chat) error.errorHandler(404, "No message exists", "chat");
  },
  validChatUser: (chat, userId) => {
    const validUser = chat.user.find(
      (user) => user._id.toString() === userId.toString()
    );

    if (!validUser) error.errorHandler(403, "Not authorized");
  },
  validAdmin: async (res, chat, userId) => {
    if (chat.admin.toString() === userId.toString()) {
      return true
    } else {
      error.errorHandler(res, "only admin can add members", "admin")
      return
    }
  }
};
