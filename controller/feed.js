const { validationResult } = require("express-validator");
const io = require("../util/socket");
const { filter } = require("p-iteration");

// Models
const Post = require("../model/post");
const User = require("../model/user");

// Helper function
const error = require("../util/error-handling/errorHandler");
const { uploadImage, removeImage } = require("../util/images/images");
const { notifyLikes, notifyComment } = require("../util/notifications");
const {
  populatePost,
  getPost,
  getCommentIndex,
  getExistingComment,
  getReplyIndex,
} = require("../util/post");

/*******************************
 * Get posts from current user *
 *******************************/
module.exports.getPosts = async (req, res, next) => {
  try {
    let posts;

    posts = await Post.find().sort({ updatedAt: -1 })
      .populate("creator")
      .populate("likes", "firstName lastName fullName profileImage")
    posts.sort((a, b) => b.updatedAt - a.updatedAt);

    res.status(200).json({ posts });
  } catch (err) {
    error.error(err, next);
  }
};

/*******************
 * Comment on Post *
 *******************/
module.exports.postComment = async (req, res, next) => {
  const postId = req.params.postId,
    content = req.body.content,
    image = req.file,
    userId = req.body.userId;

  try {
    const post = await getPost(postId);
    const user = await User.findById(userId);

    // Check for user
    if (!user) {
      error.errorHandler(res, "user not found", "user");
      return;
    }
    if (!post) {
      error.errorHandler(res, "post not found", "post");
      return;
    }

    // Check both content and image
    if (!content && !image) {
      error.errorHandler(res, "comment cannot be empty", "comment");
      return;
    }

    let imageUrl, imageId, comment;
    if (image) {
      let uploadedImage = await uploadImage(req.file.path);
      imageUrl = uploadedImage.imageUrl;
      imageId = uploadedImage.imageId;

      // Create a comment object with postImage
      comment = {
        content,
        postImage: {
          imageUrl,
          imageId,
        },
        user: userId,
      };
    } else {
      // Create a comment object
      comment = {
        content,
        user: userId,
      };
    }

    // Push comment unto comments array
    post.comments.push(comment);

    // Save comment to post
    await post.save();

    // Get updated post
    const updatedPost = await Post.findById(
      postId,
      "comments creator"
    ).populate("comments.user", "firstName lastName fullName profileImage");

    // Don't send out notification if current userId matches post creator id
    if (userId !== post.creator._id.toString()) {
      await notifyComment(
        post,
        updatedPost,
        postId,
        "post",
        "add",
        post,
        user.profileImage.imageUrl
      );
    }

    io.getIO().emit("post", { action: "comment" });

    // Send response to client
    res.status(200).json({ message: "comment successfully added" });
  } catch (err) {
    error.error(err, next);
  }
};

/**************************
 * Delete Comment on Post *
 **************************/
module.exports.deleteComment = async (req, res, next) => {
  const commentId = req.body.commentId,
    postId = req.params.postId;
  const userId = req.body.userId;

  try {
    // Get main post that has the comment
    const post = await getPost(postId, "comments");

    // Check if comment still exists in the post
    const existingComment = await getExistingComment(post, commentId);

    // Check comment index
    const commentIndex = await getCommentIndex(post, commentId);
    console.log(existingComment.user._id.toString(), userId);

    // Check if current userId matches with comment user._id
    if (existingComment.user.toString() !== userId.toString()) {
      error.errorHandler(res, "not authorized", "user");
      return;
    }

    let postCommentImage = post.comments[commentIndex].postImage;
    if (postCommentImage) {
      removeImage(res, postCommentImage.imageId);
    }

    // Get any associated images for all replies
    const postReplyImages = post.comments[commentIndex].replies.map(
      (reply) => reply.postImage
    );
    if (postReplyImages.length > 0) {
      postReplyImages.forEach((imageId) => removeImage(res, imageId));
    }

    // Pull comment from post comments array
    post.comments.pull(commentId);

    // Save updated post
    await post.save();

    io.getIO().emit("posts", { action: "remove comment" });

    // Send response to client
    res.status(200).json({ message: "comment has been deleted" });
  } catch (err) {
    error.error(err, next);
  }
};

/************************
 * Edit Comment on Post *
 ************************/
module.exports.editComment = async (req, res, next) => {
  const postId = req.params.postId,
    content = req.body.content,
    commentId = req.body.commentId,
    userId = req.body.userId;

  try {
    // Get Post
    const post = await getPost(postId, "comments");

    // Check if both content and postImage is empty
    if (!content) {
      error.errorHandler(res, "fields cannot be empty", "comment");
      return;
    }

    // Filter out comments array from commentId
    const commentPostIndex = post.comments.findIndex(
      (post) => post._id.toString() === commentId.toString()
    );

    // Check if comment exists
    if (commentPostIndex < 0) {
      error.errorHandler(res, "comment no found", "comment");
      return;
    }

    // Verify if userId from comment matches current user's id
    const commentUserId = post.comments[commentPostIndex].user.toString();
    if (commentUserId !== userId.toString()) {
      error.errorHandler(res, "not authorized", "user");
      return;
    }

    // Continue if there are no errors

    //  Update post to new content
    post.comments[commentPostIndex].content = content;

    // Set edited property on comment
    post.comments[commentPostIndex].edited = Date.now();

    // Save changes to post
    await post.save();

    io.getIO().emit("post", { action: "edit comment" });

    res.status(202).json({ message: "comment successfully updated" });
  } catch (err) {
    error.error(err, next);
  }
};

/**********************
 * Add Like to a Post *
 **********************/
module.exports.addLikeToPost = async (req, res, next) => {
  const postId = req.params.postId,
    userId = req.body.userId;

  try {
    const post = await Post.findById(postId)
      .populate("likes", "firstName lastName fullName profileImage")
      .populate("comments");

    const user = await User.findById(userId, "profileImage");

    // Check if user exists
    const alreadyLiked = post.likes.filter(
      (post) => post._id.toString() === userId.toString()
    );

    if (alreadyLiked.length !== 0) {
      return res.status(200).json({ status: 422 });
    }

    // Continue if there are no errors

    // Unshift current user into likes array of post
    await post.likes.push(userId);
    await post.save();

    // Get the updated post -- so population for new pushed user can work
    const updatedPost = await Post.findById(postId)
      .populate("likes", "firstName lastName fullName profileImage")
      .populate("comments.user", "firstName lastName fullName profileImage")
      .populate(
        "comments.replies.user",
        "firstName lastName fullName profileImage"
      )
      .populate("creator", "firstName lastName fullName profileImage");

    // Don't send any notification if current userId matches the post creatorId
    if (userId !== post.creator._id.toString()) {
      await notifyLikes(
        post,
        updatedPost,
        postId,
        "post",
        "add",
        post,
        user.profileImage.imageUrl
      );
    }

    io.getIO().emit("posts", { action: "post like", post: updatedPost });
    io.getIO().emit("notification");

    // Send response to client
    res.status(200).json({ message: "you have liked this post" });
  } catch (err) {
    error.error(err);
  }
};

/*************************
 * Remove Like from Post *
 *************************/
module.exports.removeLikeFromPost = async (req, res, next) => {
  const postId = req.params.postId,
    userId = req.body.userId;

  try {
    const post = await getPost(postId);

    const user = await User.findById(userId, "profileImage");

    // Check if user is undefined
    if (!user) {
      error.errorHandler(res, "user not found", "user");
      return;
    }

    // Check if user has not liked the post
    if (!post.likes.includes(userId)) {
      error.errorHandler(res, "no likes to remove", "user");
      return;
    }

    // Continue if there are no errors

    // Pull current userId from likes array
    post.likes.pull(userId);

    // Save post to database
    await post.save();

    // Remove notification from post owner

    // Get updated post
    const updatedPost = await Post.findById(postId)
      .populate("likes", "firstName lastName fullName profileImage")
      .populate("comments.user", "firstName lastName fullName profileImage")
      .populate("comments.likes", "firstName lastName fullName profileImage")
      .populate(
        "comments.replies.user",
        "firstName lastName fullName profileImage"
      )
      .populate("creator", "firstName lastName fullName profileImage");

    // Don't send any notification if current userId matches the post creatorId
    if (userId !== post.creator._id.toString()) {
      await notifyLikes(
        post,
        updatedPost,
        postId,
        "post",
        "remove",
        post,
        user.profileImage.imageUrl
      );
    }

    io.getIO().emit("post", { action: "remove", post: updatedPost });
    io.getIO().emit("notification");

    // Send response to client
    res.status(200).json({ message: "like removed", post: updatedPost });
  } catch (err) {
    error.error(err);
  }
};

/*************************
 * Add Like to a Comment *
 *************************/
module.exports.addCommentLike = async (req, res, next) => {
  const postId = req.params.postId,
    commentId = req.body.commentId,
    userId = req.body.userId;

  try {
    const post = await Post.findById(postId)
      .populate("comments.user", "firstName lastName fullName profileImage")
      .populate("comments.likes", "firstName lastName fullName profileImage");

    // Get comment index
    const commentIndex = getCommentIndex(post, commentId);

    const user = await User.findById(userId, "profileImage");

    // Check if user exists
    if (!user) error.errorHandler(res, "user not found", "user");

    // Check if current user already liked the comment
    const alreadyLiked = post.comments[commentIndex].likes.filter(
      (like) => like._id.toString() === userId.toString()
    );

    if (alreadyLiked.length !== 0) {
      return res.status(200).json({ status: 422, message: "already liked" });
    }

    // Continue if there are no errors

    // Unshift current into comments like array
    await post.comments[commentIndex].likes.unshift(req.body.userId);

    await post.save();

    // Get post comments
    const updatedPost = await Post.findById(postId)
      .populate("creator", "firstName lastName fullName profileImage")
      .populate("comments.user", "firstName lastName fullName profileImage")
      .populate("comments.likes", "firstName lastName fullName profileImage")
      .populate(
        "comments.replies.likes",
        "firsName lastName fullName profileImage"
      )
      .populate(
        "comments.replies.user",
        "firstName lastName fullName profileImage"
      );

    // Don't send notification to current userId if it matches the post creator
    if (userId !== post.creator._id.toString()) {
      await notifyLikes(
        post.comments[commentIndex],
        updatedPost.comments[commentIndex],
        commentId,
        "comment",
        "add",
        post,
        user.profileImage.imageUrl
      );
    }

    io.getIO().emit("post", { action: "add comment like", post: updatedPost });
    io.getIO().emit("notification");

    // Send response to client
    res
      .status(200)
      .json({ message: "you have liked this comment", post: updatedPost });
  } catch (err) {
    error.error(err, next);
  }
};

/********************************
 * Remove a Like from a Comment *
 ********************************/
module.exports.removeCommentLike = async (req, res, next) => {
  const postId = req.params.postId,
    commentId = req.body.commentId,
    userId = req.body.userId;

  try {
    const post = await Post.findById(postId);

    // Check if comment still exist in post array
    const commentIndex = getCommentIndex(post, commentId);

    const user = await User.findById(userId, "profileImage");

    // Check if user exists
    if (!user) error.errorHandler(res, "user not found", "user");

    // Check if user has a like on the comment
    const hasLike = post.comments[commentIndex].likes.includes(userId);
    if (!hasLike) error.errorHandler(res, "no likes to remove", "like");

    // Continue if there are no errors

    // Pull current user from comments like array
    post.comments[commentIndex].likes.pull(userId);

    // Save post to database
    await post.save();

    // Get updated post
    const updatedPost = await Post.findById(postId)
      .populate("creator", "firstName lastName fullName profileImage")
      .populate("comments.user", "firstName lastName fullName profileImage")
      .populate("comments.likes", "firstName lastName fullName profileImage")
      .populate(
        "comments.replies.likes",
        "firstName lastName fullName profileImage"
      )
      .populate(
        "comments.replies.user",
        "firstName lastName fullName profileImage"
      );

    // Get comment post
    const commentPost = updatedPost.comments[commentIndex];

    //  Don't send any notification if current userId matches the post creatorId
    if (userId !== post.creator._id.toString()) {
      await notifyLikes(
        commentPost,
        commentPost,
        commentId,
        "comment",
        "remove",
        post,
        user.profileImage.imageUrl
      );
    }

    io.getIO().emit("post", {
      action: "remove comment like",
      post: updatedPost,
    });
    io.getIO().emit("notification");

    // Send response to client
    res.status(200).json({ message: "like successfully removed" });
  } catch (err) {
    error.error(err, next);
  }
};

/**************************
 * Add Reply to a Comment *
 **************************/
module.exports.addReply = async (req, res, next) => {
  const postId = req.params.postId,
    commentId = req.body.commentId,
    content = req.body.content,
    image = req.file,
    userId = req.body.userId;

  try {
    const user = await User.findById(userId, "profileImage");

    // Check if user is undefined
    if (!user) {
      error.errorHandler(res, "user not found", "user");
      return;
    }

    const post = await getPost(postId);

    // Check if post still exists
    if (!post) {
      error.errorHandler(res, "post not found", "post");
      return;
    }

    // Check if comment still exists
    const commentIndex = getCommentIndex(post, commentId);

    // continue if there are no errors

    // check if an image is selected
    let imageUrl, imageId;
    if (image) {
      const uploadedImage = await uploadImage(image.path);
      imageUrl = uploadedImage.imageUrl;
      imageId = uploadedImage.imageId;
    }

    // create reply object with its content
    const reply = {
      content,
      postImage: {
        imageUrl,
        imageId,
      },
      user: userId,
    };

    // unshift reply unto comment reply array
    post.comments[commentIndex].replies.push(reply);

    // save comments to database
    await post.save();

    // Get updated post
    const updatedPost = await Post.findById(postId, "comments")
      .populate("comments.user")
      .populate("comments.replies.user");

    // don't send a notification if current userId matches updatedPost comments userId
    if (req.userId !== updatedPost.comments[commentIndex].user._id.toString()) {
      await notifyComment(
        updatedPost.comments[commentIndex],
        updatedPost.comments[commentIndex],
        commentId,
        "reply",
        "add",
        user.profileImage.imageUrl
      );
    }

    io.getIO().emit("posts", { action: "reply" });

    // Send response to client
    res.status(200).json({ message: "reply add successfully" });
  } catch (err) {
    error.error(err, next);
  }
};

/*****************************
 * Remove Reply from Comment *
 *****************************/
module.exports.removeReply = async (req, res, next) => {
  const postId = req.params.postId,
    commentId = req.body.commentId,
    replyId = req.body.replyId,
    userId = req.body.userId;

  try {
    const post = await getPost(postId, "comments");

    // check if comment still exists
    const commentIndex = getCommentIndex(post, commentId);

    // check if reply still exists
    const replyIndex = post.comments[commentIndex].replies.findIndex(
      (reply) => reply._id.toString() === replyId.toString()
    );

    if (replyIndex < 0) {
      error.errorHandler(res, "comment not found", "comment");
      return;
    }

    // check if replies userId matches current userId
    if (
      post.comments[commentIndex].replies[replyIndex].user.toString() !==
      userId.toString()
    ) {
      error.errorHandler(res, "not authorized", "user");
      return;
    }

    // Continue if there are no errors

    // check if reply has any image
    const replyImage =
      post.comments[commentIndex].replies[replyIndex].postImage;

    if (replyImage.imageUrl) {
      removeImage(res, replyImage.imageId);
    }

    // remove reply from comment
    post.comments[commentIndex].replies.pull(replyId);

    // save updated post to database
    await post.save();

    io.getIO().emit("posts", { action: "remove reply" });

    // send response to client
    res.status(200).json({ message: "reply removed successfully" });
  } catch (err) {
    error.error(err, next);
  }
};

/***********************
 * Add Like to a Reply *
 ***********************/
module.exports.addLikeToReply = async (req, res, next) => {
  const postId = req.params.postId,
    commentId = req.body.commentId,
    replyId = req.body.replyId,
    userId = req.body.userId;

  try {
    const post = await Post.findById(postId, "comments")
      .populate(
        "comments.replies.user",
        "firstName lastName fullName profileImage"
      )
      .populate(
        "comments.replies.likes",
        "firstName lastName fullName profileImage"
      );

    const commentIndex = getCommentIndex(post, commentId);

    // Check if reply comment still exists
    const replyIndex = getReplyIndex(post, commentIndex, replyId);

    const user = await User.findById(userId, "profileImage");

    // check if user exists
    if (!user) {
      error.errorHandler(res, "user not found", "user");
      return;
    }

    // check if user has liked the reply already
    const hasLiked = post.comments[commentIndex].replies[
      replyIndex
    ].likes.filter((user) => user._id.toString() === userId.toString());
    if (hasLiked.length !== 0) {
      res.status(200).json({ message: "you've liked this before" });
    }

    // continue if there are no errors

    // add current user to likes array of reply
    await post.comments[commentIndex].replies[replyIndex].likes.unshift(userId);

    // save updated post
    await post.save();

    // Get updated post
    const updatedPost = await Post.findById(postId)
      .populate("creator", "firstName lastName fullName profileImage")
      .populate("comments.user", "firstName lastName fullName profileImage")
      .populate(
        "comments.replies.user",
        "firstName lastName fullName profileImage"
      )
      .populate(
        "comments.replies.likes",
        "firstName lastName fullName profileImage"
      );

    // get comment post
    const replyPost = updatedPost.comments[commentIndex].replies[replyIndex];

    // don't send notification if current user is post creator
    if (userId !== replyPost.user._id.toString()) {
      await notifyLikes(
        replyPost,
        replyPost,
        replyId,
        "comment",
        "add",
        post,
        user.profileImage.imageUrl
      );
    }

    io.getIO().emit("posts", { action: "add reply like", post: updatedPost });

    io.getIO().emit("notification");

    // send response to client
    res.status(200).json({ message: "you have liked this comment" });
  } catch (err) {
    error.error(err, next);
  }
};

/**************************
 * Remove Like from Reply *
 **************************/
module.exports.removeLikeFromReply = async (req, res, next) => {
  const postId = req.params.postId,
    commentId = req.body.commentId,
    replyId = req.body.replyId,
    userId = req.body.userId;

  try {
    // get post
    const post = await getPost(postId, "comments _id");

    // check if comment exists
    await getExistingComment(post, commentId);

    // get comment and reply index
    const commentIndex = await getCommentIndex(post, commentId),
      replyIndex = await getReplyIndex(post, commentIndex, replyId);

    // find user
    const user = await User.findById(userId, "profileImage");

    // check if user exists
    if (!user) {
      error.errorHandler(res, "user not found", "user");
      return;
    }
    // check if user liked this reply
    const hasLiked =
      post.comments[commentIndex].replies[replyIndex].likes.includes(userId);

    if (!hasLiked) {
      error.errorHandler(res, "no like to remove", "like");
      return;
    }

    // continue if there are no errors

    // pull current user from likes array of reply
    post.comments[commentIndex].replies[replyIndex].likes.pull(userId);

    // save updated post
    await post.save();

    // get updated post
    const updatedPost = await Post.findById(postId)
      .populate("creator", "firstName lastName fullName profileImage")
      .populate("comments.user", "firstName lastName fullName profileImage")
      .populate("comments.replies", "firstName lastName fullName profileImage")
      .populate(
        "comments.replies.likes",
        "firstName lastName fullName profileImage"
      );

    // get comment post
    const replyPost = updatedPost.comments[commentIndex].replies[replyIndex];

    // Don't send any notification to current user if id matches post creator id
    if (userId.toString() !== replyPost.user._id.toString()) {
      await notifyLikes(
        replyPost,
        replyPost,
        replyId,
        "comment",
        "remove",
        post,
        user.profileImage.imageUrl
      );
    }

    io.getIO().emit("posts", {
      action: "remove like from reply",
      post: updatedPost,
    });

    io.getIO().emit("notification");

    // send response to client
    res.status(200).json({ message: "like successfully removed" });
  } catch (err) {
    error.error(err, next);
  }
};

/****************
 * Update Reply *
 ****************/
module.exports.updateReply = async (req, res, next) => {
  const postId = req.params.postId,
    commentId = req.body.commentId,
    replyId = req.body.replyId,
    content = req.body.content,
    userId = req.body.userId;

  try {
    // get and validate post
    const post = await getPost(postId, "comments");

    // check if comment still exists
    getExistingComment(post, commentId);

    // get comment index
    const commentIndex = await getCommentIndex(post, commentId);

    // check if reply comment is still there
    const replyIndex = await getReplyIndex(replyId);

    // check if reply creator matches current userId
    const canEdit =
      post.comments[commentIndex].replies[replyIndex].user._id.toString() ===
      userId.toString();
    if (!canEdit) {
      error.errorHandler(res, "not authorized", "user");
      return
    }

    // continue if there are no errors
    post.comments[commentIndex].replies[replyIndex].content = content;

    // save updated post
    await post.save();

    io.getIO().emit("posts", { action: "edit reply" });
    io.getIO().emit("notification");

    // send response to client
    res.status(200).json({ message: "reply successfully updated" });
  } catch (err) {
    error.error(err, next);
  }
};

/*********************
 * Get Notifications *
 *********************/
module.exports.getNotifications = async (req, res, next) => {
  const userId = req.params._id;

  try {
    const user = await User.findById(userId, "notifications");

    if (!user) error.errorHandler(res, "user not found", "user");

    // continue if there are no errors

    // filter out content > payload > source post to see if the original post still exists
    user.notifications.content = user.notifications.content.filter(
      async (item) => {
        if (item.payload.alertType !== "friend request") {
          const post = await Post.findById(item.payload.sourcePost);
          if (!post) return false;
        }
        if (!item.message) return false;

        return true;
      }
    );

    await user.save();

    // send response to client
    res.status(200).json({
      message: "notifications fetched",
      notifications: user.notifications,
    });
  } catch (err) {
    error.error(err, next);
  }
};

/***********************
 * Clear Notifications *
 ***********************/
module.exports.clearNotifications = async (req, res, next) => {
  const userId = req.params._id,
    type = req.body.type;

  try {
    const user = await User.findById(userId, "notifications");

    if (!user) {
      error.errorHandler(res, "user not found", "user")
      return
    }
    // continue if there are no errors
    if (type === "clear") user.notifications.content = [];

    // set notification count to 0
    user.notifications.count = 0;

    // save update
    await user.save();

    io.getIO().emit("notification")

    // send response to client
    res.status(200).json({ message: "notifications cleared" });
  } catch (err) {
    error.error(err, next);
  }
};

/******************
 * Clear Messages *
 ******************/
module.exports.clearMessagesCount = async (req, res, next) => {
  const userId = req.params.userId;

  try {
    const user = await User.findById(userId, "messages");

    // check if user is undefined
    if (!user) error.errorHandler(res, "user not found", "user");

    // reset messages count to 0
    user.messages.count = 0;

    await user.save();

    res.status(200).json({ message: "message count cleared" });
  } catch (err) {
    error.error(err, next);
  }
};

/*******************
 * Get Single Post *
 *******************/
module.exports.getSinglePost = async (req, res, next) => {
  const postId = req.params.postId;

  try {
    // get post
    const post = await Post.findById(postId)
      .populate("likes", "firstName lastName fullName profileImage")
      .populate("creator", "firstName lastName fullName profileImage")
      .populate("comments.user", "firstName lastName fullName profileImage")
      .populate(
        "comments.replies.user",
        "firstName lastName fullName profileImage"
      )
      .populate(
        "comments.replies.likes",
        "firstName lastName fullName profileImage"
      );

    // check if post is undefined
    if (!post) error.errorHandler(res, "post not found", "post");

    // continue if post is undefined

    // return post to client
    res.status(200).json({ message: "post fetch", post });
  } catch (err) {
    error.error(err, next);
  }
};

/**********************
 * Update Single Post *
 **********************/
module.exports.editPost = async (req, res, next) => {
  const postId = req.params.postId,
    content = req.body.content;

  try {
    const post = await Post.findById(postId, "content");

    if (!user) error.errorHandler(res, "post not found", "post");

    // continue if there are no errors
    post.content = content;

    // save post updates
    await post.save();

    io.getIO().emit("posts", { action: "update" });

    // send response to client
    res.status(200).json({ message: "post updated" });
  } catch (err) {
    error.error(err, next);
  }
};
