const express = require("express");
const router = express.Router();
const userController = require("../controller/user");
const multer = require("multer");
const { body } = require("express-validator");

const upload = multer({ dest: "../uploads" });

// Posts Routes
router.post("/post", upload.single("file"), userController.createPost);
router.patch("/post", upload.single("file"), userController.updatePost);
router.delete("/post", userController.deletePost);
router.get("/posts", userController.getPosts);

// Request Routes
router.post("/friend-request", userController.sendRequest);
router.get("/friend-request/:_id", userController.getFriendRequests);
router.delete("/friend-request", userController.clearFriendRequestCount);
router.post("/accept-friend", userController.acceptRequest);
router.post("/decline-friend", userController.declineRequest);
router.post("/cancel-friend", userController.cancelFriendRequest);
router.delete("/remove-friend", userController.removeFriend);

// Message Routes
router.post(
  "/message",
  [body("message", "Message cant be empty").not().isEmpty()],
  userController.sendMessage
);
router.delete("/message", userController.clearMessageCount);
router.post("/chatroom/add", userController.addFriendToChatroom);
router.delete("/chatroom/remove", userController.removeFriendFromChatroom);
router.delete("/chatroom/leave", userController.leaveChatroom);
router.post("/chatroom/create", userController.createChatroom);

router.get("/messages/:_id", userController.getMessages);
router.get("/singleChat", userController.getSingleChat)
router.post(
  "/chatroom/:_id",
  [body("message", "message can't be empty").not().isEmpty()],
  userController.messageChatroom
);
router.delete("/messages/count/:_id", userController.clearMessageCount)

router.get("/profile/:_id", userController.getUserProfile);
router.get("/friends/:_id", userController.getUserFriends)

router.post("/search", userController.searchUser);

module.exports = router;
