const { body } = require("express-validator");

const express = require("express");
const router = express.Router();

const feedController = require("../controller/feed");

// post routes
router.get("/posts", feedController.getPosts);
router.get("/post/:postId", feedController.getSinglePost);
router.patch("/post/:postId", feedController.editPost);

// post comments routes
router.post("/post/comment/:postId", feedController.postComment);
router.patch("/post/comment/:postId", feedController.editComment);
router.delete("/post/comment/:postId", feedController.deleteComment);

// post like routes
router.post("/post/:postId/like", feedController.addLikeToPost);
router.delete("/post/:postId/like", feedController.removeLikeFromPost);

// post comment like routes
router.post("/post/:postId/comment/like", feedController.addCommentLike);
router.delete("/post/:postId/comment/like", feedController.removeCommentLike);

// post comment reply routes
router.post("/post/:postId/comment/reply", feedController.addReply);
router.patch("/post/:postId/comment/reply", feedController.updateReply);
router.delete("/post/:postId/comment/reply", feedController.removeReply);

// post comment reply like routes
router.post("/post/:postId/comment/reply/like", feedController.addLikeToReply);
router.delete("/post/:postId/comment/reply/like", feedController.removeLikeFromReply);

// notifications routes
router.get("/notifications/:_id", feedController.getNotifications);
router.delete("/notifications/:_id", feedController.clearNotifications);

router.delete("/messages/count", feedController.clearMessagesCount);

module.exports = router