const bcrypt = require("bcryptjs");
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

module.exports = { signUp };