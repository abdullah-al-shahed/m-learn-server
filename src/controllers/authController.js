const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const signUp = async (req, res) => {
  try {
    const { name, email, phone, guardianPhone, password } = req.body || {};

    if (!name || !email || !phone || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, phone and password are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }],
    });
    if (existing) {
      return res
        .status(409)
        .json({ message: "An account with this email or phone already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      phone,
      guardianPhone,
      password: hashedPassword,
    });

    res.status(201).json({
      message: "Account created successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "An account with this email or phone already exists" });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    console.error("Sign-up error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

const signIn = async (req, res) => {
  try {
    const { identifier, password } = req.body || {};

    if (!identifier || !password) {
      return res
        .status(400)
        .json({ message: "Email or phone and password are required" });
    }

    const id = String(identifier).trim();
    const query = id.includes("@")
      ? { email: id.toLowerCase() }
      : { phone: id };

    const user = await User.findOne(query).select("+password");
    const isMatch = user ? await bcrypt.compare(password, user.password) : false;

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email/phone or password" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    res.json({
      message: "Signed in successfully",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Sign-in error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

module.exports = {  signUp, signIn };