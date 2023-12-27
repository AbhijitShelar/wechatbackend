const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

const mongoose = require("mongoose");
const http = require("http"); // Import http module

const { initializeSocket, User } = require("./socket");
dotenv.config();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
const corsOptions = {
  origin: "https://wechat1.netlify.app",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

const server = http.createServer(app); // Create an HTTP server

// Initialize socket and pass the server to it
const io = initializeSocket(server);

app.get("/", (req, res) => {
  res.json({ message: "server" });
});

//Creating database using mongoose(odm)
const userInfo = mongoose.model("userInfo", {
  firstName: String,
  lastName: String,
  email: String,
  password: String,
  mobile: Number,
  age: Number,
});

//Signup Api
app.post("/api/signup", async (req, res) => {
  try {
    const { firstName, lastName, email, password, mobile, age } = req.body;
    const encryptedPassword = await bcrypt.hash(password, 10);
    await userInfo.create({
      firstName,
      lastName,
      email,
      password: encryptedPassword,
      mobile,
      age,
    });
    res.json({
      status: "SUCCESS",
      message: "You've signed up successfully!",
    });
  } catch (error) {
    console.log(error);
    res.json({
      status: "FAILED",
      message: "Something went wrong",
    });
  }
});

const validateTokenMiddleware = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (authHeader) {
    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.json({
        status: false,
        message: "Token not provided",
      });
    }

    jwt.verify(token, "123", (err, decoded) => {
      if (err) {
        return res.json({
          status: false,
          message: "Invalid token",
        });
      }

      req.user = decoded;
      next();
    });
  } else {
    return res.json({
      status: false,
      message: "No token Provided",
    });
  }
};

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await userInfo.findOne({ email });

    if (user && user.password) {
      let hasPasswordMatched = await bcrypt.compare(password, user.password);
      if (hasPasswordMatched) {
        const token = jwt.sign({ userId: user._id }, "123", {
          expiresIn: "1h",
        });
        res.json({
          message: "You have Logged In successfully",
          status: true,
          token: token,
          name: user.firstName,
          userId: user._id.toString(),
        });
      } else {
        res.json({
          message: "Incorrect Password",
          status: false,
        });
      }
    } else {
      res.json({
        message: "User Does not Exist",
        status: false,
      });
    }
  } catch (error) {
    console.log(error);
  }
});

//To get all Users List
app.get("/api/userslist", validateTokenMiddleware, async (req, res) => {
  try {
    const usersList = await User.find();
    res.json(usersList);
  } catch (error) {
    console.log(error);
  }
});
//get account details of user
app.post("/api/accountdetails", validateTokenMiddleware, async (req, res) => {
  try {
    const {myId}=req.body;

    const accountDetails= await userInfo.findOne({myId});
    res.json(accountDetails);
  } catch (error) {
    console.log(error);
  }
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  mongoose
    .connect(process.env.MONGODB_URL)
    .then(() =>
      console.log(`Connection Successful and Server running on port: ${PORT}`)
    )
    .catch((error) => console.log(error));
});
