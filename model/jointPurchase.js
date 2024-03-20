const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const jointPurchaseSchema = new Schema({
  creator: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  content: { type: String },
  interestedPartners: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  product: {
    type: Schema.Types.ObjectId,
    ref: "Product",
  },
  status: {
    type: Boolean,
  },
  deadline: { type: String, required: true },
});

module.exports = mongoose.model("JointPurchase", jointPurchaseSchema);
