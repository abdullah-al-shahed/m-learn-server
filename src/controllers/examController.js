const mongoose = require("mongoose");
const Course = require("../models/Course");
const Exam = require("../models/Exam");

// Returns a Date, or null if the value is not a valid date
const toDate = (value) => {
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
};

// Admin: create an exam (unpublished by default)
const createExam = async (req, res) => {
  try {
    const { title, course, startAt, endAt, durationMin, passMarks, attemptLimit } =
      req.body || {};

    if (!title || !course || !startAt || !endAt || !durationMin) {
      return res.status(400).json({
        message: "Title, course, startAt, endAt and durationMin are required",
      });
    }

    const courseId = String(course);
    if (
      !mongoose.isValidObjectId(courseId) ||
      !(await Course.exists({ _id: courseId }))
    ) {
      return res.status(404).json({ message: "Course not found" });
    }

    const start = toDate(startAt);
    const end = toDate(endAt);
    if (!start || !end) {
      return res.status(400).json({ message: "Invalid date" });
    }
    if (end <= start) {
      return res
        .status(400)
        .json({ message: "End time must be after start time" });
    }

    const exam = await Exam.create({
      title,
      course: courseId,
      startAt: start,
      endAt: end,
      durationMin,
      passMarks,
      attemptLimit,
    });

    res.status(201).json({ message: "Exam created", exam });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    console.error("Create exam error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Public: schedule of published exams
const getPublicExams = async (req, res) => {
  try {
    const exams = await Exam.find({ isPublished: true })
      .sort({ startAt: 1 })
      .populate("course", "title")
      .select("title course startAt endAt durationMin totalMarks");

    res.json({ count: exams.length, exams });
  } catch (error) {
    console.error("Get exams error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Admin: all exams including unpublished
const getAllExamsAdmin = async (req, res) => {
  try {
    const exams = await Exam.find()
      .sort({ startAt: -1 })
      .populate("course", "title");

    res.json({ count: exams.length, exams });
  } catch (error) {
    console.error("Get all exams error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Admin: update exam details or publish/unpublish
const updateExam = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Exam not found" });
    }

    const exam = await Exam.findById(id);
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    const body = req.body || {};
    const allowed = ["title", "durationMin", "passMarks", "attemptLimit", "isPublished"];
    allowed.forEach((key) => {
      if (body[key] !== undefined) exam[key] = body[key];
    });

    if (body.startAt !== undefined) {
      const start = toDate(body.startAt);
      if (!start) return res.status(400).json({ message: "Invalid startAt" });
      exam.startAt = start;
    }
    if (body.endAt !== undefined) {
      const end = toDate(body.endAt);
      if (!end) return res.status(400).json({ message: "Invalid endAt" });
      exam.endAt = end;
    }

    if (exam.endAt <= exam.startAt) {
      return res
        .status(400)
        .json({ message: "End time must be after start time" });
    }

    await exam.save();
    res.json({ message: "Exam updated", exam });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    console.error("Update exam error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

module.exports = { createExam, getPublicExams, getAllExamsAdmin, updateExam };