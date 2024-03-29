const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    loggedIn: { type: Boolean, default: false },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    pharmacy: [
      {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "Pharmacy",
      },
    ],
    profileImage: {
      imageUrl: {
        type: String,
        // required: true,
        default:
          "https://res.cloudinary.com/dex0mkckw/image/upload/v1704787280/m2wguhgput2td9gypin8.png",
      },
      imageId: {
        type: String,
        // required: true,
        default: "m2wguhgput2td9gypin8",
      },
    },
    bannerImage: {
      imageUrl: {
        type: String,
        // required: true,
      },
      imageId: {
        type: String,
        // required: true,
      },
    },
    details: {
      email: {
        type: String,
        lowercase: true,
        // required: true,
      },
      about: {
        type: String,
        // required: true,
        default: "No Bio",
      },
      gender: {
        type: String,
        // required: true,
      },
      state: {
        type: String,
        required: true,
      },
      address: {
        type: String,
        required: true,
      },
      phoneNumber: {
        type: String,
        required: true,
      },
    },
    friends: [
      {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "User",
      },
    ],
    posts: [
      {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "Post",
      },
    ],
    notifications: {
      count: {
        type: Number,
        required: true,
        default: 0,
      },
      content: [
        {
          payload: {
            originalId: {
              type: Schema.Types.ObjectId,
              ref: "Post",
            },
            content: String,
            alertType: {
              type: String,
              required: true,
            },
            friendId: {
              type: Schema.Types.ObjectId,
              ref: "User",
            },
            sourcePost: {
              type: Schema.Types.ObjectId,
              ref: "Post",
            },
            userImage: String,
          },
          message: {
            type: String,
          },
          date: {
            type: Date,
            default: Date.now,
          },
        },
      ],
    },
    requests: {
      count: {
        type: Number,
        required: true,
        default: 0,
      },
      content: [
        {
          user: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "User",
          },
          date: {
            type: Date,
            default: Date.now,
          },
          friendId: {
            type: Schema.Types.ObjectId,
            ref: "User",
          },
        },
      ],
    },
    messages: {
      count: {
        type: Number,
        required: true,
        default: 0,
      },
      singlechatcontent: [
        {
          type: Schema.Types.ObjectId,
          required: true,
          ref: "Chat",
        },
      ],
      chatroomcontent: [
        {
          type: Schema.Types.ObjectId,
          required: true,
          ref: "ChatRoom",
        },
      ],
    },
    resetToken: String,
    resetExpiration: Date,
  },
  {
    toJSON: {
      virtuals: true,
    },
  }
);

const virtualFullName = userSchema.virtual("fullName");
virtualFullName.get(function () {
  return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model("User", userSchema);
