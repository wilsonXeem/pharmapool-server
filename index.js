const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const compression = require("compression");
const isAuth = require("./util/is-auth/isAuth");
const cors = require("cors");

// Set up dotenv
dotenv.config();

// mongoose.connect("mongodb://localhost:27017/FB_Clone")

// Routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const feedRoutes = require("./routes/feed");
const profileRoutes = require("./routes/profile");
const businessRoutes = require("./routes/business");

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
  })
);

app.use(compression());

// Parse incoming requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Set headers
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, , X-Requested-With, Origin, Accept"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "OPTIONS, GET, POST, PUT, PATCH, DELETE"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// Authentication check
// app.use(isAuth);

// Endpoints
app.use("/auth", authRoutes);
app.use("/feed", feedRoutes);
app.use("/user", userRoutes);
app.use("/profile", profileRoutes);
app.use("/business", businessRoutes);

app.get("/", (req, res, next) => {
  res.send("Hello World");
});

app.use((req, res, next) => {
  if (req.originalUrl && req.originalUrl.split("/").pop() === "favicon.ico") {
    return res.sendStatus(204);
  }
  return next();
});

// Error handler
app.use((err, req, res, next) => {
  const status = err.statusCode,
    message = err.message,
    type = err.type || "";

  res.status(status).json({ message, status, type });
});

mongoose
  .connect(process.env.MONGO_URL)
  .then((result) => {
    console.log("database connected");
  })
  .catch((err) => console.log(err));

const server = app.listen(process.env.PORT || 8000, () =>
  console.log("server started")
);

const io = require("./util/socket").init(server);

io.on("connection", (socket) => {});
