// models
const Product = require("../model/product");
const Pharmacy = require("../model/pharmacy");
const Demand = require("../model/demand");
const JointPurchase = require("../model/jointPurchase");
const User = require("../model/user");
const ChatRoom = require("../model/chatroom");
const Sale = require("../model/salesatdiscount");

// middle wares
const error = require("../util/error-handling/errorHandler");
const io = require("../util/socket");
const { uploadImage, removeImage } = require("../util/images/images");

/*************************
 * Create Product Demand *
 *************************/
module.exports.createProductDemand = async (req, res, next) => {
  const genericName = req.body.genericName,
    brandName = req.body.brandName,
    strength = req.body.strength,
    expiryDate = req.body.expiryDate,
    date = Date.now(),
    manufacturer = req.body.manufacturer,
    locationOfPharmacy = req.body.locationOfPharmacy,
    content = req.body.content,
    userId = req.params._id,
    quantity = req.body.quantity;

  try {
    // validate user
    const user = await User.findById(userId);
    if (!user) {
      error.errorHandler(res, "not authorized", "user");
      return;
    }

    // check for image
    let imageUrl, imageId;
    if (req.file) {
      const uploadedImage = await uploadImage(req.file.path);
      imageUrl = uploadedImage.imageUrl;
      imageId = uploadedImage.imageId;
    }

    // Add new product
    const product = new Product({
      owner: userId,
      genericName,
      brandName,
      strength,
      expiryDate,
      date,
      manufacturer,
      quantity,
      productImage: { imageUrl, imageId },
      locationOfPharmacy,
    });

    // save new product
    const newProduct = await product.save();

    // add new demand
    const demand = new Demand({
      creator: userId,
      content,
      product: newProduct._id,
    });

    // save demand
    await demand.save();

    // populate product
    const demandMade = await Demand.findById(demand._id)
      .populate("product")
      .populate("interestedPartners", "firstName lastName profileImage");

    io.getIO().emit("demand", { action: "make demand", demandMade });

    res
      .status(200)
      .json({ message: "demand created successfully", demandMade });
  } catch (err) {
    error.error(err, next);
  }
};

/***************************
 * Add Interested Partners *
 ***************************/
module.exports.addInterestedPartners = async (req, res, next) => {
  const demandId = req.params._id,
    userId = req.body.userId,
    amount = req.body.amount;

  try {
    // validate user
    const user = await User.findById(userId);
    if (!user) {
      error.errorHandler(res, "not authorized", "user");
    }

    // validate demand
    const demand = await Demand.findById(demandId, "interestedPartners");
    if (!demand) {
      error.errorHandler(res, "demand not found", "demand");
    }

    // check if user is already in interestedPartners array
    const alreadyInterested = demand.interestedPartners.find(
      (user) => user.user._id.toString() === userId.toString()
    );
    if (alreadyInterested) {
      error.errorHandler(
        res,
        "you have already declared interest",
        "interested partner"
      );
      return;
    }

    //   continue if there are no errors

    //   create interested partner object
    const interestedPartner = {
      user: userId,
      price: amount,
    };

    //   add interested partner in interested partners array
    demand.interestedPartners.push(interestedPartner);

    //   save demand to database
    await demand.save();

    io.getIO().emit("demand", { action: "partner added", demand });

    res.status(200).json({ message: "partner added successfully" });
  } catch (err) {
    error.error(err, next);
  }
};

/*****************************
 * Remove Interested Partner *
 *****************************/
module.exports.removeInterestedPartner = async (req, res, next) => {
  const demandId = req.params._id,
    userId = req.body.userId;

  try {
    // validate user
    const user = await User.findById(userId);
    if (!user) {
      error.errorHandler(res, "not authorized", "user");
      return;
    }

    // validate demand
    const demand = await Demand.findById(demandId, "interestedPartners");
    if (!demand) {
      error.errorHandler(res, "demand not found", "demand");
      return;
    }

    // check if user is in interestedPartners array of demand
    const interestedPartner = demand.interestedPartners.find(
      (user) => user.user._id.toString() === userId.toString()
    );
    if (!interestedPartner) {
      error.errorHandler(res, "user not a partner", "user");
      return;
    }

    // continue if there are no errors

    // pull user from interestedPartners array
    await demand.interestedPartners.pull({ user: userId });

    // save changes
    await demand.save();

    io.getIO().emit("demand", { action: "user removed", demand });

    res.status(200).json({ message: "partner removed successfully" });
  } catch (err) {
    error.error(err, next);
  }
};

/************************
 * Change Demand Status *
 ************************/
module.exports.changeDemandStatus = async (req, res, next) => {
  const demandId = req.params._id,
    userId = req.body.userId;

  try {
    // validate demand
    const demand = await Demand.findById(demandId, "status").populate(
      "creator",
      "firstName lastName profileImage"
    );
    if (!demand) {
      error.errorHandler(res, "demand not found", "demand");
      return;
    }

    // validate user
    const user = await User.findById(userId);
    if (!user) {
      error.errorHandler(res, "not authorized", "user");
      return;
    }

    // check if user is demand creator
    if (demand.creator._id.toString() !== userId.toString()) {
      error.errorHandler(res, "not authorized", "creator");
      return;
    }

    demand.status = true;

    //  save changes
    demand.save();

    io.getIO().emit("demand", { action: "demand status updated", demand });

    res.status(200).json({ message: "demand status updated successfully" });
  } catch (err) {
    error.error(err, next);
  }
};

/*************************
 * Create Joint Purchase *
 *************************/
module.exports.createJointPurchase = async (req, res, next) => {
  const genericName = req.body.genericName,
    brandName = req.body.brandName,
    strength = req.body.strength,
    expiryDate = req.body.expiryDate,
    date = Date.now(),
    manufacturer = req.body.manufacturer,
    locationOfPharmacy = req.body.locationOfPharmacy,
    creator = req.params._id,
    content = req.body.content,
    deadline = req.body.deadline,
    quantity = req.body.quantity;

  try {
    // validate user
    const user = await User.findById(creator);
    if (!user) {
      error.errorHandler(res, "not authorized", "user");
      return;
    }

    // check for image
    let imageUrl, imageId;
    if (req.file) {
      const uploadedImage = await uploadImage(req.file.path);
      imageUrl = uploadedImage.imageUrl;
      imageId = uploadedImage.imageId;
    }

    // Add new product
    const product = new Product({
      owner: creator,
      genericName,
      brandName,
      strength,
      expiryDate,
      date,
      manufacturer,
      productImage: { imageUrl, imageId },
      locationOfPharmacy,
    });

    // save new product
    await product.save();

    // add new demand
    const jointPurchase = new JointPurchase({
      creator,
      content,
      interestedPartners: [creator],
      product: product._id,
      deadline,
    });

    // save demand
    await jointPurchase.save();

    // populate product
    const jointPurchaseMade = await JointPurchase.findById(jointPurchase._id)
      .populate("product")
      .populate("interestedPartners", "firstName lastName profileImage");

    io.getIO().emit("demand", { action: "make demand", jointPurchaseMade });

    res.status(200).json({ message: "joint purchase created successfully" });
  } catch (err) {
    error.error(err, next);
  }
};

/********************************************
 * Add Interested Partner to Joint Purchase *
 ********************************************/
module.exports.addJointPurchasePartner = async (req, res, next) => {
  const jointPurchaseId = req.params._id,
    userId = req.body.userId;

  try {
    // validate user
    const user = await User.findById(userId);
    if (!user) {
      error.errorHandler(res, "not authorized", "user");
      return;
    }

    // validate joint purchase
    const jointPurchase = await JointPurchase.findById(
      jointPurchaseId,
      "interestedPartners"
    );
    if (!jointPurchase) {
      error.errorHandler(res, "joint purchase not found", "jointPurchase");
      return;
    }

    // check if user is not already a partner
    const alreadyPartner = jointPurchase.interestedPartners.find(
      (user) => user._id.toString() === userId.toString()
    );
    if (alreadyPartner) {
      error.errorHandler(res, "user is already a partner", "user");
      return;
    }

    // continue if there are no errors

    // push user to interested partners array
    jointPurchase.interestedPartners.push(userId);

    // save changes
    await jointPurchase.save();

    io.getIO().emit("jointPurchase", {
      action: "partner added",
      jointPurchase,
    });

    res.status(200).json({ message: "partner added successfully" });
  } catch (err) {
    error.errorHandler(err, next);
  }
};

/*************************************************
 * Remove Interested Partner from Joint Purchase *
 *************************************************/
module.exports.removeJointPurchasePartner = async (req, res, next) => {
  const jointPurchaseId = req.params._id,
    userId = req.body.userId;

  try {
    // validate user
    const user = await User.findById(userId);
    if (!user) {
      error.errorHandler(res, "not authorized", "user");
      return;
    }

    // validate joint purchase
    const jointPurchase = await JointPurchase.findById(
      jointPurchaseId,
      "interestedPartners"
    );
    if (!jointPurchase) {
      error.errorHandler(res, "joint purchase not found", "jointPurchase");
      return;
    }

    // check if user is a partner
    const alreadyPartner = jointPurchase.interestedPartners.find(
      (user) => user._id.toString() === userId.toString()
    );
    if (!alreadyPartner) {
      error.errorHandler(res, "user not a partner", "user");
      return;
    }

    // pull user from interested partners array
    jointPurchase.interestedPartners.pull(userId);

    // save changes
    await jointPurchase.save();

    io.getIO().emit("jointPurchase", { action: "user removed", jointPurchase });

    res.status(200).json({ message: "user removed successfully" });
  } catch (err) {
    error.errorHandler(err, next);
  }
};

/********************************
 * Change Joint Purchase Status *
 ********************************/
module.exports.changeJointPurchaseStatus = async (req, res, next) => {
  const jointPurchaseId = req.params._id,
    userId = req.body.userId;

  try {
    // validate jointPurchase
    const jointPurchase = await JointPurchase.findById(
      jointPurchaseId,
      "status"
    ).populate("creator", "firstName lastName profileImage");
    if (!jointPurchase) {
      error.errorHandler(res, "joint purchase not found", "joint purchase");
      return;
    }

    // validate user
    const user = await User.findById(userId);
    if (!user) {
      error.errorHandler(res, "not authorized", "user");
      return;
    }

    // check if user is demand creator
    if (jointPurchase.creator._id.toString() !== userId.toString()) {
      error.errorHandler(res, "not authorized", "creator");
      return;
    }

    jointPurchase.status = true;

    //  save changes
    jointPurchase.save();

    io.getIO().emit("demand", {
      action: "demand status updated",
      jointPurchase,
    });

    res.status(200).json({ message: "demand status updated successfully" });
  } catch (err) {
    error.error(err, next);
  }
};

/*******************************
 * Create Joint Purchase Group *
 *******************************/
module.exports.createJointPurchaseGroup = async (req, res, next) => {
  const jointPurchaseId = req.params._id,
    userId = req.body.userId,
    title = req.body.title;

  try {
    // validate user
    const user = await User.findById(userId);
    if (!user) {
      error.errorHandler(res, "not authorized", "user");
      return;
    }

    // validate joint purchase
    const jointPurchase = await JointPurchase.findById(
      jointPurchaseId,
      "interestedPartners"
    ).populate("creator");
    if (!jointPurchase) {
      error.errorHandler(res, "joint purchase not found", "joint purchase");
      return;
    }

    // check if current user is the creator of the joint purchase
    if (jointPurchase.creator._id.toString() !== userId.toString()) {
      error.errorHandler(res, "not authorized", "creator");
      return;
    }

    // create a group with all interested partners
    const interestedPartners = jointPurchase.interestedPartners;
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
      users: interestedPartners,
    });

    // save chat room
    await newChatRoom.save();

    //   push new chat room to interested partners
    interestedPartners.map(async (partner) => {
      const user = await User.findById(partner, "messages");
      await user.messages.chatroomcontent.push(newChatRoom._id);

      await user.save();
    });

    res
      .status(200)
      .json({ message: "joint purchase group created successfully" });
  } catch (err) {
    error.error(err, next);
  }
};

/*********************
 * Register Pharmacy *
 *********************/
module.exports.registerPharmacy = async (req, res, next) => {
  const userId = req.params._id,
    businessName = req.body.businessName,
    location = req.body.location,
    contactNumber = req.body.contactNumber,
    about = req.body.about;

  try {
    // validate user
    const user = await User.findById(userId, "pharmacy");
    if (!user) {
      error.errorHandler(res, "not authorized", "user");
      return;
    }

    let imageUrl, imageId;
    if (req.file) {
      const uploadedImage = await uploadImage(req.file.path);
      imageUrl = uploadedImage.imageUrl;
      imageId = uploadedImage.imageId;
    }

    // create new pharmacy
    const pharmacy = new Pharmacy({
      businessName,
      location,
      logo: { imageUrl, imageId },
      contactNumber: [contactNumber],
      about,
      owner: userId,
    });

    // save changes
    await pharmacy.save();

    //   add pharmacy to user
    user.pharmacy.push(pharmacy._id);
    await user.save();

    res.status(200).json({ message: "pharmacy added successfully", pharmacy });
  } catch (err) {
    error.error(err, next);
  }
};

/*************************
 * Add Pharmacy Pictures *
 *************************/
module.exports.addPharmacyImages = async (req, res, next) => {
  const pharmacyId = req.params._id,
    userId = req.body.userId,
    images = req.files;

  try {
    // validate user
    const user = await User.findById(userId);
    if (!user) {
      error.errorHandler(res, "not authorized", "user");
      return;
    }

    // validate pharmacy
    const pharmacy = await Pharmacy.findById(pharmacyId, "images");
    if (!pharmacy) {
      error.errorHandler(res, "pharmacy not found", "pharmacy");
      return;
    }

    // uploaded image
    if (images) {
      images.map(async (image) => {
        const uploadedImage = await uploadImage(image.path);
        await pharmacy.images.push({
          imageUrl: uploadedImage.imageUrl,
          imageId: uploadedImage.imageId,
        });
        await pharmacy.save();
      });
    }

    res.status(200).json({ message: "image uploaded successfully" });
  } catch (err) {
    error.error(err, next);
  }
};

/*******************
 * Delete Pharmacy *
 *******************/
module.exports.deletePharmacy = async (req, res, next) => {
  const pharmacyId = req.params._id,
    userId = req.body.userId;

  try {
    // validate user
    const user = await User.findById(userId, "pharmacy");
    if (!user) {
      error.errorHandler(res, "not authorized", "user");
      return;
    }

    // validate pharmacy
    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      error.errorHandler(res, "pharmacy not found", "pharmacy");
      return;
    }

    // check if user is the owner of the pharmacy
    if (pharmacy.owner._id.toString() !== userId.toString()) {
      error.errorHandler(res, "user not authorized", "user");
      return;
    }

    // continue if there are no errors

    // delete pharmacy from database
    await Pharmacy.findByIdAndDelete(pharmacyId);

    // pull pharmacy from user
    await user.pharmacy.pull(pharmacyId);
    await user.save();

    res.status(200).json({ message: "pharmacy deleted successfully" });
  } catch (err) {
    error.error(err, next);
  }
};

/***************************
 * Create Sale at Discount *
 ***************************/
module.exports.createSaleAtDiscount = async (req, res, next) => {
  const genericName = req.body.genericName,
    brandName = req.body.brandName,
    strength = req.body.strength,
    expiryDate = req.body.expiryDate,
    date = Date.now(),
    manufacturer = req.body.manufacturer,
    locationOfPharmacy = req.body.locationOfPharmacy,
    creator = req.params._id,
    content = req.body.content,
    deadline = req.body.deadline,
    quantity = req.body.quantity;

  try {
    // validate user
    const user = await User.findById(creator);
    if (!user) {
      error.errorHandler(res, "not authorized", "user");
      return;
    }

    // continue if there are no errors

    // create product
    const product = new Product({
      owner: creator,
      genericName,
      brandName,
      strength,
      expiryDate,
      date,
      manufacturer,
      locationOfPharmacy,
      quantity,
    });

    // save product
    await product.save();

    // create sale
    const sale = new Sale({
      creator,
      content,
      product: product._id,
      deadline,
    });

    // save sale
    await sale.save();

    io.getIO().emit("sale at discount", { action: "sale", sale });

    res.status(200).json({ message: "sale at discount created successfully" });
  } catch (err) {
    error.error(err, next);
  }
};

/***********************************
 * Add Partner to Sale at Discount *
 ***********************************/
module.exports.addPartnerToSaleAtDiscount = async (req, res, next) => {
  const saleId = req.params._id,
    userId = req.body.userId,
    quantity = req.body.quantity;

  try {
    // validate user
    const user = await User.findById(userId);
    if (!user) {
      error.errorHandler(res, "not authorized", "user");
      return;
    }

    // validate sale
    const sale = await Sale.findById(saleId, "interestedPartners");
    if (!sale) {
      error.errorHandler(res, "sale not found", "sale");
      return;
    }

    // validate quantity
    if (quantity < 0) {
      error.errorHandler(res, "please provide a valid quantity", "quantity");
      return;
    }

    // continue if there are no errors

    // add user to interested partners array
    sale.interestedPartners.push({ user: user._id, quantity });

    // save changes
    await sale.save();

    io.getIO().emit("sale", { action: "partner added", sale });

    res.status(200).json({ message: "partner added successfully" });
  } catch (err) {
    error.error(err, next);
  }
};

/***************************************************
 * Remove Interested Partner from Sale at Discount *
 ***************************************************/
module.exports.removeInterestedPartnerFromSaleAtDiscount = async (
  req,
  res,
  next
) => {
  const saleId = req.params._id,
    userId = req.body.userId;

  try {
    // validate user
    const user = await User.findById(userId);
    if (!user) {
      error.errorHandler(res, "not authorized", "user");
      return;
    }

    // validate sale
    const sale = await Sale.findById(saleId, "interestedPartners");
    if (!sale) {
      error.errorHandler(res, "sale not found", "user");
      return;
    }

    // continue if there are no errors

    // pull user from interested partners array
    await sale.interestedPartners.pull({ user: user._id });

    // save changes
    await sale.save();

    res.status(200).json({ message: "partner removed" });
  } catch (err) {
    error.error(err, next);
  }
};

/**********************************
 * Change Sale at Discount Status *
 **********************************/
module.exports.changeSaleAtDiscountStatus = async (req, res, next) => {
  const saleId = req.params._id,
    userId = req.body.userId;

  try {
    // validate user
    const user = await User.findById(userId);
    if (!user) {
      error.errorHandler(res, "not authorized", "user");
      return;
    }

    // validate sale
    const sale = await Sale.findById(saleId, "status").populate("creator");
    if (!sale) {
      error.errorHandler(res, "sale not found", "sale");
      return;
    }

    // validate user as sale creator
    if (sale.creator._id.toString() !== userId.toString()) {
      error.errorHandler(res, "not authorized", "creator");
      return;
    }

    // continue if there are no errors

    // change sale status
    sale.status = true;
    await sale.save();

    res.status(200).json({ message: "sale status changed successfully" });
  } catch (err) {
    error.errorHandler(err, next);
  }
};

/**********************
 * Get All Businesses *
 **********************/
module.exports.getAllBusinesses = async (req, res, next) => {
  const userId = req.params._id;

  try {
    // validate user
    const user = await User.findById(userId);
    if (!user) {
      error.errorHandler(res, "not authorized", "user");
      return;
    }

    // continue if there are no errors

    // get all demand
    const demand = await Demand.find()
      .populate("creator", "firstName lastName profileImage")
      .populate("product")
      .populate("interestedPartners");

    // get all joint purchase
    const jointPurchase = await JointPurchase.find()
      .populate("creator", "firstName lastName profileImage")
      .populate("product")
      .populate("interestedPartners");

    // get all sales on discount
    const sale = await Sale.find()
      .populate("creator", "firstName lastName profileImage")
      .populate("product")
      .populate("interestedPartners");

    const business = [...demand, ...jointPurchase, ...sale];

    res
      .status(200)
      .json({ message: "all businesses fetched successfully", business });
  } catch (err) {
    error.error(err, next);
  }
};
