const User = require("../model/user");

const { getUser, userExists } = require("../util/user");
const error = require("../util/error-handling/errorHandler");
const { uploadImage, removeImage } = require("../util/images/images");

/*****************************
 * Get Current User Timeline *
 *****************************/
module.exports.getUserTImeline = async (req, res, next) => {
  const userId = req.params.userId;

  try {
    const user = await User.findById(userId, { password: 0 })
      .populate("friends posts")
      .populate({
        path: "posts",
        populate: [
          {
            path: "creator",
            select: "firstName lastName fullName profileImage",
          },
          {
            path: "like",
            select: "firstName lastName fullName profileImage",
          },
        ],
      });

    //   Check if user is undefined
    if (!user) error.errorHandler(res, "User not found", "user");

    res.status(200).json({ ...user._doc, name: user.fullName });
  } catch (err) {
    error.error(err, next);
  }
};

/***********************
 * Get Profile Details *
 ***********************/
module.exports.getProfileDetails = async (req, res, next) => {
  const userId = req.params.userId;

  try {
    // Get and validate user
    const user = await User.findById(userId).populate("friends requests");

    if (!user) error.errorHandler(res, "user not found", "user");

    res
      .status(200)
      .json({ message: "user details fetched successfully", user });
  } catch (err) {
    error.error(err, next);
  }
};

/************************
 * Update User Fullname *
 ************************/
module.exports.updateUserFullname = async (req, res, next) => {
  const userId = req.params.userId,
    firstName = req.body.firstName,
    lastName = req.body.lastName;

  try {
    // Get and validate user
    const user = await getUser(userId);

    if (!user) error.errorHandler(res, "user not found", "user");

    user.firstName = firstName;
    user.lastName = lastName;

    await user.save();

    // Return response to client
    res
      .status(200)
      .json({ message: "profile updated successfully", updated: user });
  } catch (err) {
    error.error(err, next);
  }
};

/**************************
 * Update Profile Details *
 **************************/
module.exports.updateProfileDetails = async (req, res, next) => {
  const userId = req.params.userId,
    email = req.body.email,
    about = req.body.about,
    state = req.body.state,
    address = req.body.address,
    phoneNumber = req.body.phoneNumber;

  try {
    // Get and validate user
    const user = await getUser(userId);

    if (!user) error.errorHandler(res, "user not found", "user");

    user.details.email = email;
    user.details.about = about;
    user.details.state = state;
    user.details.address = address;
    user.details.phoneNumber = phoneNumber;

    await user.save();

    res
      .status(200)
      .json({ message: "profile updated successfully", updated: user.details });
  } catch (err) {
    error.error(err, next);
  }
};

/****************
 * Change Image *
 ****************/
module.exports.changeImage = async (req, res, next) => {
  const userId = req.params.userId,
    type = req.body.type;

  try {
    const uploadedImage = await uploadImage(req.file.path);

    // Get current user
    const user = await User.findById(userId);

    // Check if user exists
    if (!user) error.errorHandler(res, "user not found", "user");

    if (!uploadedImage.imageUrl)
      error.errorHandler(res, "image not uploaded", "image");

    // Continue if no errors

    let public_id;
    if (type === "profile") {
      public_id = user.profileImage.imageId;
    } else if (type === "banner") {
      public_id = user.bannerImage.imageId;
    }

    let imageUrl, imageId;
    if (uploadedImage) {
      imageUrl = uploadedImage.imageUrl;
      imageId = uploadedImage.imageId;
    }

    switch (type) {
      case "profile":
        user.profileImage.imageUrl = `${imageUrl}`;
        user.profileImage.imageId = imageId;
        removeImage(res, public_id);
        break;

      case "banner":
        user.bannerImage.imageUrl = `${imageUrl}`;
        user.bannerImage.imageUrl = imageId;
        removeImage(res, public_id);

      default:
        return;
    }

    //   Save user to database
    await user.save();
    res.status(200).json({ message: "image updated", user });
  } catch (err) {
    error.error(err, next);
  }
};
