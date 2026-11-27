const mongoose = require("mongoose");
const Course = require("../models/Course");
const Lesson = require("../models/Lesson");

// Accepts a plain 11-character ID or a YouTube link, returns the ID (or null)
const extractYoutubeId = (input) => {
  const value = String(input || "").trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;

  const match = value.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/
  );
  return match ? match[1] : null;
};

const findCourse = async (courseId) => {
  if (!mongoose.isValidObjectId(courseId)) return null;
  return Course.findById(courseId);
};

// Admin only: add a lesson to a course
const createLesson = async (req, res) => {
  try {
    const course = await findCourse(req.params.courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const { title, youtube, order, pdfLink } = req.body || {};

    if (!title || !youtube) {
      return res
        .status(400)
        .json({ message: "Title and YouTube link or ID are required" });
    }

    const youtubeId = extractYoutubeId(youtube);
    if (!youtubeId) {
      return res.status(400).json({ message: "Invalid YouTube link or ID" });
    }

    let lessonOrder;
    if (order !== undefined) {
      lessonOrder = Number(order);
      if (!Number.isFinite(lessonOrder)) {
        return res.status(400).json({ message: "Order must be a number" });
      }
    } else {
      const last = await Lesson.findOne({ course: course._id }).sort({
        order: -1,
      });
      lessonOrder = last ? last.order + 1 : 1;
    }

    const lesson = await Lesson.create({
      course: course._id,
      title,
      youtubeId,
      order: lessonOrder,
      pdfLink,
    });

    res.status(201).json({ message: "Lesson created", lesson });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    console.error("Create lesson error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Public: only titles and order, no video info
const getLessonTitles = async (req, res) => {
  try {
    const course = await findCourse(req.params.courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const lessons = await Lesson.find({ course: course._id })
      .sort({ order: 1 })
      .select("title order");

    res.json({ count: lessons.length, lessons });
  } catch (error) {
    console.error("Get lesson titles error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Signed-in users: full details including the YouTube ID
const getLessonsForWatching = async (req, res) => {
  try {
    const course = await findCourse(req.params.courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const lessons = await Lesson.find({ course: course._id })
      .sort({ order: 1 })
      .select("title order youtubeId pdfLink");

    res.json({ count: lessons.length, lessons });
  } catch (error) {
    console.error("Get lessons error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

module.exports = { createLesson, getLessonTitles, getLessonsForWatching };