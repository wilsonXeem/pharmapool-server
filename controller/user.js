const { validationResult } = require("express-validator");
const { forEach } = require("p-iteration");
const io = require("../util/socket");

// Models
const Post = require("../model/post"),
  User = require("../model/user"),
  Chat = require("../model/chat"),
  ChatRoom = require("../model/chatroom");

// Helper functions
const error = require("../util/error-handling/errorHandler");
const { userExists, getUser } = require("../util/user");
const { getPost, populatePost } = require("../util/post");
const { getChat, validChatUser, validAdmin } = require("../util/chat");
const { notifyFriend, notifyFriendRequest } = require("../util/notifications");
const { uploadImage, removeImage } = require("../util/images/images");

/***************
 * Create Post *
 ***************/
module.exports.createPost = async (req, res, next) => {
  const content = req.body.content,
    userId = req.body.userId;
  if (!req.file) {
    try {
      // Get current user
      const user = await userExists("id", userId);

      // Check if user is undefined
      if (!user) error.errorHandler(res, "not authorize", "user");

      // Check if both inputs are valid
      if (!content) error.errorHandler(res, "no content posted", "input");

      // Continue if there are no errors

      // Create new post
      const post = new Post({
        content,
        creator: user._id.toString(),
      });

      // Add new post to post array in user
      user.posts.push(post);
      await user.save();

      // Save post to database
      const createdPost = await post.save();

      io.getIO().emit("posts", { action: "create post" });

      // Return response back to client
      res
        .status(201)
        .json({ message: "post created successfully", createdPost });
    } catch (err) {
      error.error(err, next);
    }
  } else {
    try {
      const uploadedImage = await uploadImage(req.file.path);

      // Get current user
      const user = await userExists("id", userId);

      // Check if user is undefined
      if (!user) error.errorHandler(res, "not authorizedd", "user");

      // Check if both inputs are invalid
      if (!uploadedImage.imageUrl && !content)
        error.errorHandler(res, "no content posted", "input");

      // Continue if there are no errors
      let imageUrl, imageId;
      if (uploadedImage) {
        imageUrl = uploadedImage.imageUrl;
        imageId = uploadedImage.imageId;
      }

      // Create new post
      const post = new Post({
        content,
        postImage: {
          imageUrl,
          imageId,
        },
        creator: user._id.toString(),
      });

      // Add new post to user posts array
      user.posts.push(post);
      await user.save();

      // Save post to database
      const createdPost = await post.save();

      io.getIO().emit("posts", { action: "create post" });

      // Return response back to client
      res
        .status(201)
        .json({ message: "post created successfully", createdPost });
    } catch (err) {
      error.error(err, next);
    }
  }
};

/***************
 * Update Post *
 ***************/
module.exports.updatePost = async (req, res, next) => {
  const userId = req.body.userId,
    content = req.body.content,
    postId = req.body.postId;

  try {
    // Upload image if any
    let uploadedImage;
    if (req.file) {
      uploadedImage = await uploadImage(req.file.path);
    }

    const post = await getPost(postId);

    // Check if both content is undefined
    if (!content) error.errorHandler(res, "post cannot be empty", "input");

    // Check if post creator id matches current user id
    if (post.creator.toString() !== userId.toString())
      error.errorHandler(res, "not authorized", "user");

    // Continue if there are no errors
    post.content = content;

    if (uploadedImage) {
      post.postImage.imageUrl = uploadedImage.imageUrl;
      post.postImage.imageId = uploadedImage.imageId;
    }

    post.edited = Date.now();

    // Save updated post to database
    await post.save();

    // Send response to client
    res.status(201).json({ message: "post updated successfully", post });
  } catch (err) {
    error.error(err, next);
  }
};

/***************
 * Delete Post *
 ***************/
module.exports.deletePost = async (req, res, next) => {
  const userId = req.body.userId,
    postId = req.body.postId;

  try {
    // Check if user is authenticated
    // if (!req.isAuth) error.errorHandler(res, "not Authorized", "user");

    const user = await userExists("id", userId);
    const post = await getPost(postId);

    // Check if user exists
    if (!user) error.errorHandler(res, "user not found", "user");

    // Check if post exists
    if (!post) error.errorHandler(res, "post not found", "post");

    // Check if user has permission to remove post
    if (post.creator.toString() !== userId.toString())
      error.errorHandler(res, "not authorized", "user");

    // Check if post has image
    const postImage = post.postImage;
    if (postImage.imageId) {
      await removeImage(res, postImage.imageId);
    }

    // Loop through post comments for all comments with images and remove them
    if (post.comments.length > 0) {
      post.comments.forEach((comment) => {
        if (comment.postImage) removeImage(comment.postImage.imageId);
        if (comment.replies.length > 0) {
          comment.replies.forEach((reply) => {
            if (reply.postImage) removeImage(reply.postImage.imageId);
          });
        }
      });
    }

    // Remove post from posts array
    user.posts.pull(postId);
    await user.save();

    // Remove post from posts array
    await Post.findByIdAndDelete(postId);

    io.getIO().emit("posts", {
      action: "delete post",
      postId: post._id.toString(),
    });

    // Send response to client
    res.status(201).json({ message: "post deleted successfully" });
  } catch (err) {
    error.error(err, next);
  }
};

/*************
 * Get Posts *
 *************/
module.exports.getPosts = async (req, res, next) => {
  const userId = req.body.userId;
  try {
    const user = await User.findById(userId).populate("posts");

    // Check if user is defined
    if (!user) error.errorHandler(res, "user not found", "user");

    // Continue if there are no errors

    const posts = user.posts;

    // send response to client
    res.status(200).json({ message: "posts fetched successfully", posts });
  } catch (err) {
    error.error(err, next);
  }
};

/****************
 * Send Request *
 ****************/
module.exports.sendRequest = async (req, res, next) => {
  const friendId = req.body.friendId,
    userId = req.body.userId;

  try {
    // Get receiving user info
    const receivingUser = await getUser(friendId),
      currentUser = await userExists("id", userId);

    // Check if currentUser exist
    if (!currentUser) error.errorHandler(res, "not authorized", "user");

    // Check if currentUser doesn't already have a pending request
    if (
      currentUser.requests.content.find(
        (req) => req.user.toString() === friendId.toString()
      )
    ) {
      res.status(500).json({ message: "you already have a pending request" });
      return;
    }

    // Check if requestingUser doesn't already have same pending request
    const existingRequest = receivingUser.requests.content.find(
      (item) => item.user.toString() === userId.toString()
    );

    if (existingRequest) {
      res.status(500).json({ message: "request sent already" });
      return;
    }

    // Check if users aren't friends already
    const isFriends = currentUser.friends.find(
      (friend) => friend.toString() === friendId
    );

    if (isFriends) {
      error.errorHandler(res, "already friends with this user", "user");
      return;
    }

    // Continue if no errors

    // Add notification to users about the request
    await notifyFriendRequest(currentUser, receivingUser, "friend request");

    const contentData = {
      user: userId,
      date: Date.now(),
    };

    // Add currentUser to receivingUser requests array
    receivingUser.requests.content.push(contentData);
    receivingUser.requests.count += 1;
    await receivingUser.save();

    io.getIO().emit("notification");
    io.getIO().emit("friend");

    // Send response to client
    res.status(200).json({
      message: "friend request sent",
      friend: receivingUser,
    });
  } catch (err) {
    error.error(err, next);
  }
};

/**************************
 * Decline Friend Request *
 **************************/
module.exports.declineRequest = async (req, res, next) => {
  const requestId = req.body.requestId,
    userId = req.body.userId;

  try {
    // Check if there are no errors
    const user = await userExists("id", userId);

    if (!user) error.errorHandler(res, "not authorized", "user");

    // Check if requesting user exists
    const existingRequest = user.requests.content.find(
      (req) => req._id.toString() === requestId
    );

    if (!existingRequest)
      error.errorHandler(res, "friend request not found", "user");

    // Remove count from user
    if (user.requests.count !== 0) {
      user.requests.count = user.requests.count - 1;
    }

    user.requests.content.pull(requestId);

    await user.save();

    io.getIO().emit("notification");

    res.status(200).json({ message: "friend request declined" });
  } catch (err) {
    error.error(err, next);
  }
};

/*************************
 * Accept Friend Request *
 *************************/
module.exports.acceptRequest = async (req, res, next) => {
  const friendId = req.body.friendId,
    requestId = req.body.requestId,
    userId = req.body.userId;

  try {
    // Get current user profile
    const currentUser = await userExists("id", userId);

    // check if currentUser is undefined
    if (!currentUser) error.errorHandler(res, "not authorized", "user");

    // Get requestingUser profile
    const requestingUser = await getUser(friendId);

    // check if friends already
    if (
      currentUser.friends.find(
        (user) => user._id.toString() === friendId.toString()
      )
    ) {
      error.errorHandler(res, "you are friends already", "friend");
      return;
    }

    // Add both users to friends array
    await currentUser.friends.push(requestingUser);
    await requestingUser.friends.push(currentUser);

    // Remove notification from currentUser
    currentUser.requests.count = currentUser.requests.count - 1;
    currentUser.requests.content.pull(requestId);

    // Add notification to both users
    await notifyFriend(currentUser, requestingUser, "friend request");

    //Save changes
    await currentUser.save();
    await requestingUser.save();

    io.getIO().emit("notification");
    io.getIO().emit("handle friend", {
      action: "accept request",
      id: [userId, friendId],
    });

    // Send response to client
    res.status(200).json({ message: "friend request accepted" });
  } catch (err) {
    error.error(err, next);
  }
};

/*************************
 * Cancel Friend Request *
 *************************/
module.exports.cancelFriendRequest = async (req, res, next) => {
  const friendId = req.body.friendId,
    userId = req.body.userId;

  try {
    const friend = await User.findById(
      friendId,
      "requests firstName lastName fullName profileImage"
    );

    // Check if friend is undefined
    if (!friend) error.errorHandler(res, "user not found", "friend");

    // Remove pending request on friend request content
    friend.requests.content = friend.requests.content.filter(
      (req) => req.user.toString() !== userId.toString()
    );

    // Decrement friend request count
    if (friend.requests.count > 0) {
      friend.requests.count = friend.requests.count - 1;
    }

    await friend.save();

    io.getIO().emit("notification");

    // Send response to client
    res.status(200).json({ message: "friend request cancelled" });
  } catch (err) {
    error.error(err, next);
  }
};

/*****************
 * Remove Friend *
 *****************/
module.exports.removeFriend = async (req, res, next) => {
  const userId = req.body.userId,
    friendId = req.body.friendId;

  try {
    const friend = await getUser(friendId);

    // Get currentUser
    const currentUser = await userExists("id", userId);

    // Check if currentUser is undefined
    if (!currentUser) error.errorHandler(res, "friend not found", "friend");

    // Check if friendId does not exist in currentUser's friends list
    if (!currentUser.friends.includes(friendId)) {
      error.errorHandler(res, "friend not found", "friend");
    }

    // Continue if there are no errors

    // Remove friend from currentUser
    currentUser.friends.pull(friendId);

    // Remove currentUser from friend
    friend.friends.pull(userId);

    // Save changes
    await currentUser.save();
    await friend.save();

    io.getIO().emit("notification");
    io.getIO().emit("handle friend", {
      action: "accept request",
      id: [userId, friendId],
    });

    // Send response to client
    res.status(200).json({ message: "friend removed successfully" });
  } catch (err) {
    error.error(err, next);
  }
};

/****************
 * Send Message *
 ****************/
module.exports.sendMessage = async (req, res, next) => {
  const friendId = req.body.friendId,
    message = req.body.message,
    userId = req.body.userId;

  try {
    // Get and validate user
    const user = await getUser(userId);

    // Get and validate friend
    const friend = await getUser(friendId);

    // Check input validation
    const validatorErrors = validationResult(req);

    error.validationError(validatorErrors);

    // Continue if there are no errors

    // Check if you already have a chat going on with just the user
    const existingChat = await Chat.findOne({
      $and: [
        { users: { $elemMatch: { userId: friendId } } },
        { users: { $elemMatch: { userId: userId } } },
      ],
    });

    if (existingChat) {
      // Add unto existingChat with friend

      // Push new message unto messages array on chat
      existingChat.messages.push({
        user: userId,
        message,
        date: Date.now(),
      });
      // Add count to messages for recipient user
      friend.messages.count += 1;

      await friend.save();

      // Save changes
      await existingChat.save();
    } else {
      // Create new chat with friend

      // Create new chat object
      const chat = new Chat({
        users: [{ userId: friendId }, { userId: userId }],
        messages: [{ user: userId, message }],
      });

      // Add created messages to both currentUser and friend messages array
      user.messages.singlechatcontent.unshift(chat);
      friend.messages.singlechatcontent.unshift(chat);

      friend.messages.count += 1;

      // Save update
      await chat.save();
      await user.save();
      await friend.save();
    }

    // Send response to client
    res.status(200).json({ message: "message sent!" });
  } catch (err) {
    error.error(err, next);
  }
};

/*************************
 * Add Friend to Chatroom *
 *************************/
module.exports.addFriendToChatroom = async (req, res, next) => {
  const userId = req.body.userId,
    chatId = req.body.chatId,
    friendId = req.body.friendId;

  try {
    // Get message and verify it still exists
    const chat = await ChatRoom.findById(chatId);

    if (!chat) {
      error.errorHandler(res, "chat room does not exist", "chatroom");
      return;
    }

    // Verify current chat to see if current requesting user is allowed to add in new users
    // validAdmin(res, chat, userId);
    if (chat.admin.toString() !== userId.toString()) {
      error.errorHandler(res, "only admin can add new members", "admin");
      return;
    }

    const user = await getUser(userId);

    if (!user.friends.includes(friendId)) {
      error.errorHandler(res, "friend not found", "friend");
      return;
    }

    // Check if friend isn't already in the chat
    if (
      chat.users.find((user) => user.userId.toString() === friendId.toString())
    ) {
      error.errorHandler(res, "this user is already in the chatroom", "friend");
      return;
    }

    // Continue if there are no errors

    // Add friend to chat users array
    chat.users.push({ userId: friendId });

    const friend = await getUser(friendId, "messages");

    // Add current chatId to friend messages array
    friend.messages.chatroomcontent.unshift(chatId);

    // Add to message count
    friend.messages.count = friend.messages.count + 1;

    // Save updates
    await chat.save();
    await friend.save();

    io.getIO().emit("message", {
      action: "add user",
      chatId,
    });

    // Send response to client
    res.status(200).json({ message: "friend has been added to the chatroom" });
  } catch (err) {
    error.error(err, next);
  }
};

/*******************************
 * Remove Friend from Chatroom *
 *******************************/
module.exports.removeFriendFromChatroom = async (req, res, next) => {
  const userId = req.body.userId,
    chatId = req.body.chatId,
    friendId = req.body.friendId;

  try {
    // Get and validate chat
    const chat = await ChatRoom.findById(chatId);

    // Verify current chat to see if current requesting user is allowed to remove user
    if (chat.admin.toString() !== userId.toString()) {
      error.errorHandler(res, "only admin can remove members", "admin");
      return;
    }

    const user = await getUser(userId);

    // Check if friend still exists in user's friend list
    if (!user.friends.includes(friendId)) {
      error.errorHandler(res, "friend not found", "friend");
      return;
    }

    // Check if friend is still in current chat
    if (
      !chat.users.find((user) => user.userId.toString() === friendId.toString())
    ) {
      error.errorHandler(res, "user not currently in chat", "user");
      return;
    }

    // Continue if there are no errors

    // Pull friend from chat users array
    await chat.users.pull({ userId: friendId });

    const friend = await getUser(friendId, "messages");

    // Remove chatId from friend messages array
    friend.messages.chatroomcontent.pull(chatId);

    // Save updates
    await chat.save();
    await friend.save();

    // send response to client
    res.status(200).json({ message: "user removed from chatroom" });
  } catch (err) {
    error.error(err, next);
  }
};

/*******************
 * Leave Chat Room *
 *******************/
module.exports.leaveChatroom = async (req, res, next) => {
  const chatId = req.body.chatId,
    userId = req.body.userId;

  try {
    // Get and validate user
    const user = await getUser(userId, "messages");

    // Get and validate current chat message
    const chat = await ChatRoom.findById(chatId);

    // Check if user is currently in the chat
    if (
      !chat.users.find((user) => user.userId.toString() === userId.toString())
    ) {
      error.errorHandler(res, "not authorized", "user");
      return;
    }

    // Continue if there are no errors

    // Remove current user from chat users array
    chat.users.pull({ userId: userId });

    // Remove chatId from current user messages array
    user.messages.chatroomcontent.pull(chatId);

    // Save changes
    await chat.save();
    await user.save();

    // Check if there are no users in the users array in the chat object
    const totalUsers = chat.users.length;

    if (totalUsers <= 0) {
      // Delete entire message object from database
      await chat.remove({});
    }

    io.getIO().emit("messages", { action: "leave chat", chatId });

    // Send response to client
    res.status(200).json({ message: "you have left the chatroom" });
  } catch (err) {
    error.error(err, next);
  }
};

/****************
 * Get Messages *
 ****************/
module.exports.getMessages = async (req, res, next) => {
  const userId = req.params._id;

  try {
    // Get and validate user
    const user = await User.findById(userId, "messages")
      .populate({
        path: "messages.singlechatcontent",
        populate: [
          {
            path: "users.userId",
            select: "firstName lastName fullName profileImage",
          },
          {
            path: "messages.user",
            select: "firstName lastName fullName profileImage",
          },
        ],
      })
      .populate({
        path: "messages.chatroomcontent",
        populate: [
          {
            path: "users.userId",
            select: "firstName lastName fullName profileImage",
          },
          {
            path: "messages",
          },
        ],
      });

    if (!user) {
      error.errorHandler(res, "no user found", "user");
      return;
    }

    // Send response to client
    res.status(200).json({
      message: "messages fetched successfully",
      messages: user.messages,
    });
  } catch (err) {
    error.error(err, next);
  }
};

/**************************
 * Messaging in Chat Room *
 **************************/
module.exports.messageChatroom = async (req, res, next) => {
  const userId = req.body.userId,
    chatId = req.params._id,
    message = req.body.message;

  try {
    // Get and validate chat
    const chat = await ChatRoom.findById(chatId);
    if (!chat) {
      error.errorHandler(err, "chatroom not found", "chat");
      return;
    }

    // Check if user is valid
    if (
      !chat.users.find((user) => user._id.toString() === userId.toString())
    ) {
      error.errorHandler(err, "not authorized", "user");
      return;
    }

    // Check input validation
    const validationError = validationResult(req);

    error.validationError(validationError);

    // Continue if there are no errors

    // Create message object
    const newMessage = {
      user: userId,
      message,
      date: Date.now(),
    };

    // Send message notification to all users in current chat except the current user
    const chatUsers = chat.users;

    forEach(chatUsers, async (item) => {
      const user = await User.findById(item._id);

      if (user._id.toString() && item.userId.toString() !== userId.toString()) {
        // Send message notification to each valid user

        //  Check if user doesn't already have current chatId in their messages content array
        const existingChatNotification =
          user.messages.chatroomcontent.includes(chatId);

        if (existingChatNotification) {
          // Pull existing chat from user
          await user.messages.chatroomcontent.pull(chatId);

          // Unshift new chat content to user
          await user.messages.chatroomcontent.unshift(chatId);
        } else {
          // Unshift new chat content to user
          await user.messages.chatroomcontent.unshift(chatId);
        }

        // Add to messages count on user
        user.messages.count = user.messages.count + 1;

        // Save user changes
        await user.save();
      }
    });

    // Push new message unto messages array in chat object
    chat.messages.push(newMessage);

    // Save chat updates
    await chat.save();

    // Send response to client
    res.status(200).json({ message: "message sent" });
  } catch (err) {
    error.error(err, next);
  }
};

/*******************
 * Create Chatroom *
 *******************/
module.exports.createChatroom = async (req, res, next) => {
  const userId = req.body.userId,
    title = req.body.title;

  try {
    // check user
    const user = await User.findById(userId);
    if (!user) {
      error.errorHandler(res, "not authorized", "user");
    }

    const existingRoom = await ChatRoom.findOne({ title });

    if (existingRoom) {
      error.errorHandler(res, "chat room exist already", "chatroom");
      return;
    }

    // continue if there are no errors

    // create new chat room
    const newChatRoom = new ChatRoom({
      title,
      admin: userId,
      users: [{ userId }],
    });

    // save chat room
    await newChatRoom.save();

    // add chatroom to user chatroom array
    await user.messages.chatroomcontent.push(newChatRoom._id);

    // save changes
    await user.save();

    io.getIO().emit("notification");
    io.getIO().emit("chat room", {
      action: "create chat room",
      newChatRoom,
    });

    // Send response to client
    res
      .status(200)
      .json({ message: "chat room created successfully", newChatRoom });
  } catch (err) {
    error.error(err, next);
  }
};

/********************
 * Get User Profile *
 ********************/
module.exports.getUserProfile = async (req, res, next) => {
  const userId = req.params._id;

  try {
    // Get and validate user
    const user = await User.findById(userId, { password: 0 })
      .populate(
        "requests.content.user",
        "firstName lastName fullName profileImage"
      )
      .populate(populatePost)
      .populate({
        path: "friends",
        select: "firstName lastName fullName profileImage",
        options: { limit: 12 },
      });

    // Check if user is undefined
    if (!user) {
      error.errorHandler(404, "user not found");
      return;
    }

    // Send response to client
    res.status(200).json({ message: "user fetched successfully", user });
  } catch (err) {
    error.error(err, next);
  }
};

/********************
 * Get User Friends *
 ********************/
module.exports.getUserFriends = async (req, res, next) => {
  const userId = req.params._id;

  try {
    // Get and validate user
    const user = await User.findById(
      userId,
      "friends firstName lastName"
    ).populate("friends", "firstName lastName profileImage");

    if (!user) {
      error.errorHandler(res, "user not found", "user");
      return;
    }

    // Continue if there are no errors

    // Send response to client
    res.status(200).json({ message: "friends fetched successfully", user });
  } catch (err) {
    error.error(err, next);
  }
};

/***********************
 * Clear Message Count *
 ***********************/
module.exports.clearMessageCount = async (req, res, next) => {
  const userId = req.params._id;

  try {
    const user = await User.findById(userId, "messages");

    // Check if user is undefined
    if (!user) {
      error.errorHandler(res, "user not found", "user");
      return;
    }

    // Reset user message count
    user.messages.count = 0;

    await user.save();

    io.getIO().emit("notification");

    // Send response to client
    res.status(200).json({ message: "message count cleared" });
  } catch (err) {
    error.error(err, next);
  }
};

/******************************
 * Clear Friend Request Count *
 ******************************/
module.exports.clearFriendRequestCount = async (req, res, next) => {
  const userId = req.body.userId;

  try {
    // Get and validate user
    const user = await User.findById(userId, "requests");

    // Check if user is undefined
    if (!user) {
      error.errorHandler(res, "user not found", "user");
      return;
    }

    // Continue if there are no errors

    // Set requests count to 0
    user.requests.count = 0;

    // Save changes
    await user.save();

    io.getIO().emit("notification");

    // Send response to client
    res.status(200).json({ message: "friend request count reset" });
  } catch (err) {
    error.error(err, next);
  }
};

/*******************
 * Search For User *
 *******************/
module.exports.searchUser = async (req, res, next) => {
  const name = req.body.name;

  try {
    const user = await User.find(
      {
        $or: [
          { firstName: { $regex: name, $options: "i" } },
          { lastName: { $regex: name, $options: "i" } },
        ],
      },
      "firstName lastName fullName profileImage"
    );

    if (!user) {
      error.errorHandler(err, "user not found", "user");
      return;
    }

    res.status(200).json({ user });
  } catch (err) {
    error.error(err, next);
  }
};

/*******************
 * Get Single Chat *
 *******************/
module.exports.getSingleChat = async (req, res, next) => {
  const chatId = req.params.chatId,
    userId = req.body.userId;

  try {
    const chat = await Chat.findById(chatId)
      .populate("users.userId", "firstName lastName fullName profileImage")
      .populate("messages.user", "firstName lastName fullName profileImage");

    // Check if chat exists
    if (!chat) error.errorHandler(res, "no chat found", "chat");

    // Check if current userId is included in users array of chat
    const isIncluded = chat.users.filter(
      (user) => user.userId._id.toString() === userId.toString()
    );

    if (isIncluded.length === 0)
      error.errorHandler(res, "not authorized", "user");

    // Continue if there are no errors
    res.status(200).json({ message: "chat fetched successfully", chat });
  } catch (err) {
    error.error(err, next);
  }
};

/**************************
 * Get User Friend Request *
 **************************/
module.exports.getFriendRequests = async (req, res, next) => {
  const userId = req.params._id;

  try {
    const user = await User.findById(userId)
      .populate(
        "requests.content.user",
        "firstName lastName fullName profileImage"
      )
      .populate(
        "requests.content.friendId",
        "firstName lastName fullName profileImage"
      );

    // Check if user is undefined
    if (!user) error.errorHandler(res, "user not found", "user");

    res.status(200).json({ request: user.requests });
  } catch (err) {
    error.error(err, next);
  }
};
