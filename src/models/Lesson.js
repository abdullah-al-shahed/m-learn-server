const mongoose = require("mongoose");

const lessonSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: 150,
    },
    youtubeId: {
      type: String,
      required: [true, "YouTube video is required"],
    },
    order: {
      type: Number,
      default: 1,
    },
    pdfLink: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Lesson", lessonSchema);