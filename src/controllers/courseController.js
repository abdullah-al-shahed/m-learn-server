const mongoose = require("mongoose");
const Course = require("../models/Course");

// Admin only: create a course
const createCourse = async (req, res) => {
  try {
    const { title, subject, level, fee, description, image, status } =
      req.body || {};

    if (!title || !subject) {
      return res
        .status(400)
        .json({ message: "Title and subject are required" });
    }

    const course = await Course.create({
      title,
      subject,
      level,
      fee,
      description,
      image,
      status,
      createdBy: req.user._id,
    });

    res.status(201).json({ message: "Course created", course });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    console.error("Create course error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Public: list active courses, optional filters ?subject=...&level=...
const getCourses = async (req, res) => {
  try {
    const filter = { status: "active" };
    if (req.query.subject) filter.subject = String(req.query.subject);
    if (req.query.level) filter.level = String(req.query.level);

    const courses = await Course.find(filter).sort({ createdAt: -1 });
    res.json({ count: courses.length, courses });
  } catch (error) {
    console.error("Get courses error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Public: single course details
const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Course not found" });
    }

    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.json({ course });
  } catch (error) {
    console.error("Get course error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

module.exports = { createCourse, getCourses, getCourseById };