const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: [true, "Question text is required"],
      trim: true,
      maxlength: 1000,
    },
    type: {
      type: String,
      enum: ["mcq", "truefalse", "short"],
      required: [true, "Question type is required"],
    },
    options: {
      type: [String],
      default: [],
    },
    // mcq: index of the correct option ("0", "1", ...)
    // truefalse: "true" or "false"
    // short: optional model answer for the teacher's reference
    correctAnswer: {
      type: String,
      default: "",
    },
    marks: {
      type: Number,
      min: 0,
      default: 1,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Question", questionSchema);