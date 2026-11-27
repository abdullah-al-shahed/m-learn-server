const mongoose = require("mongoose");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");

// Student: apply to a course
const applyToCourse = async (req, res) => {
  try {
    const { courseId } = req.body || {};

    if (!mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({ message: "A valid courseId is required" });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    if (course.status !== "active") {
      return res
        .status(400)
        .json({ message: "Admission for this course is closed" });
    }

    const existing = await Enrollment.findOne({
      student: req.user._id,
      course: course._id,
    });
    if (existing) {
      return res.status(409).json({
        message: `You have already applied (status: ${existing.status})`,
      });
    }

    const enrollment = await Enrollment.create({
      student: req.user._id,
      course: course._id,
    });

    res.status(201).json({ message: "Application submitted", enrollment });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "You have already applied" });
    }
    console.error("Apply error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Student: list my applications
const getMyEnrollments = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ student: req.user._id })
      .populate("course", "title subject level fee image status")
      .sort({ createdAt: -1 });

    res.json({ count: enrollments.length, enrollments });
  } catch (error) {
    console.error("Get my enrollments error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

module.exports = { applyToCourse, getMyEnrollments };