const Post = require('../model/post')

const error = require('./error-handling/errorHandler')

module.exports = {
  getPost: async (postId, select = null) => {
    const post = await Post.findById(postId, select);

    if (!post) error.errorHandler(404, "Post not found", "post");

    return post;
  },
  getCommentIndex: (post, commentId) => {
    const commentIndex = post.comments.findIndex(
      (comment) => comment._id.toString() === commentId.toString()
    );

    if (commentIndex < 0)
      error.errorHandler(404, "Comment not found", "comment");

    return commentIndex;
  },
  getExistingComment: (post, commentId) => {
    const existingComment = post.comments.find(
      (comment) => comment._id.toString() === commentId.toString()
    );

    if (!existingComment) error.errorHandler(404, "Comment does not exist");

    return existingComment;
  },
  getReplyIndex: (post, commentIndex, replyId) => {
    const replyIndex = post.comments[commentIndex].replies.findIndex(
      (reply) => reply._id.toString() === replyId.toString()
    );

    if (replyIndex < 0) error.errorHandler(404, "Comment not found", "reply");

    return replyIndex;
  },

  populatePost: {
    path: "posts",
    options: { sort: { createdAt: -1 } },
    populate: [
      {
        path: "likes",
        select: "firstName lastName profileImage",
      },
      {
        path: "comments.likes",
        select: "firstName lastName profileImage",
      },
      {
        path: "creator",
        select: "firstName lastName profileImage",
      },
      {
        path: "comments.user",
        select: "firstName lastName profileImage",
      },
      {
        path: "comments.replies.user",
        select: "firstName lastName profileImage",
      },
      {
        path: "comments.replies.likes",
        select: "firstName lastName profileImage",
      },
    ],
  },
};