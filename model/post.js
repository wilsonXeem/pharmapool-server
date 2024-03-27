const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const postSchema = new Schema(
  {
    content: String,
    postImage: {
      imageUrl: {
        type: String,
      },
      imageId: {
        type: Schema.Types.ObjectId,
      },
    },
    edited: Date,
    creator: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    comments: [
      {
        user: {
          type: Schema.Types.ObjectId,
          required: true,
          ref: "User",
        },
        content: String,
        postImage: {
          imageUrl: {
            type: String,
            // required: true,
          },
          imageId: {
            type: Schema.Types.ObjectId,
            // required: true,
          },
        },
        createdAt: {
          type: Date,
          default: Date.now(),
        },
        likes: [
          {
            type: Schema.Types.ObjectId,
            ref: "User",
          },
        ],
        replies: [
          {
            user: {
              type: Schema.Types.ObjectId,
              required: true,
              ref: "User",
            },
            edited: Date,
            content: String,
            postImage: {
              imageUrl: {
                type: String,
                // required: true,
              },
              imageId: {
                type: Schema.Types.ObjectId,
                // required: true,
              },
            },
            createdAt: {
              type: Date,
              default: Date.now(),
            },
            likes: [
              {
                type: Schema.Types.ObjectId,
                ref: "User",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Post", postSchema);
