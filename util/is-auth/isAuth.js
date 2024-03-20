const dotenv= require("dotenv")
const jwt = require("jsonwebtoken")

dotenv.config()

const isAuth = (req, res, next) => {
    // Get headers
    const headers = req.get("Authorization")

    // Check if headers is empty
    if (!headers) {
        req.isAuth = false
        return next()
    }

    // Check if headers, extract the token out of it
    const token = headers.split(" ")[1]

    let authorizedToken

    // Verify token
    try {
        authorizedToken = jwt.verify(token, process.env.jwtKey)
    } catch (err) {
        req.isAuth = false
        return next()
    }

    // Check if authorized token
    if (!authorizedToken) {
        req.isAuth = false
        return next()
    }

    // Continue if there are no errors
    req.isAuth = true

    // Set userId
    req.userId = authorizedToken.userId

    next()
}

module.exports = isAuth