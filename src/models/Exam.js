const mongoose = require("mongoose");

const examSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: 150,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    startAt: {
      type: Date,
      required: [true, "Start time is required"],
    },
    endAt: {
      type: Date,
      required: [true, "End time is required"],
    },
    durationMin: {
      type: Number,
      required: [true, "Duration is required"],
      min: 1,
    },
    totalMarks: {
      type: Number,
      default: 0,
    },
    passMarks: {
      type: Number,
      min: 0,
      default: 0,
    },
    attemptLimit: {
      type: Number,
      min: 1,
      default: 1,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Exam", examSchema);