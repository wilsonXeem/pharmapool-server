const User = require("../model/user");

const error = require("./error-handling/errorHandler");

module.exports = {
  userExists: async (type, value) => {
    let user;

    switch (type) {
      case "id":
        user = await User.findById(value);
        return user;

      case "email":
        user = await User.findOne({ "details.email": value });
        return user;

      default:
        return;
    }
  },
  getUser: async (userId, select = null, res) => {
    const user = await User.findById(userId, select);

    if (!user) error.errorHandler(res, "No user found", "user");

    return user;
  },
};
