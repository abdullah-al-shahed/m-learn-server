require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

const seedAdmin = async () => {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PHONE, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_EMAIL || !ADMIN_PHONE || !ADMIN_PASSWORD) {
    console.error("Set ADMIN_EMAIL, ADMIN_PHONE and ADMIN_PASSWORD in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const existing = await User.findOne({
      $or: [{ email: ADMIN_EMAIL.toLowerCase() }, { phone: ADMIN_PHONE }],
    });

    if (existing) {
      console.log(
        `A user with this email or phone already exists (role: ${existing.role}). Nothing changed.`
      );
    } else {
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await User.create({
        name: ADMIN_NAME || "Admin",
        email: ADMIN_EMAIL,
        phone: ADMIN_PHONE,
        password: hashedPassword,
        role: "admin",
      });
      console.log(`Admin created: ${ADMIN_EMAIL}`);
    }
  } catch (error) {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

seedAdmin();