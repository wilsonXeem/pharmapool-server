const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const productSchema = new Schema({
  owner: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  genericName: { type: String, required: true },
  brandName: { type: String, required: true },
  strength: { type: String, required: true },
  expiryDate: { type: String },
  date: { type: Date, default: Date.now() },
  manufacturer: { type: String, required: true },
  productImage: [{ imageUrl: { type: String }, imageId: { type: String } }],
  locationOfPharmacy: { type: String, required: true },
  quantity:{type:Number, required: true}
});

module.exports = mongoose.model("Product", productSchema);
