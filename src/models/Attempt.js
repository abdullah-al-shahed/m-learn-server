const mongoose = require("mongoose");

const attemptSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
    },
    // The shuffled order of question IDs, fixed for this attempt
    questionOrder: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Question" },
    ],
    // questionId -> answer
    answers: {
      type: Map,
      of: String,
      default: {},
    },
    status: {
      type: String,
      enum: ["in_progress", "submitted"],
      default: "in_progress",
    },
    startedAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    submittedAt: { type: Date },
    score: { type: Number, default: 0 },
    autoScore: { type: Number, default: 0 }, // marks from mcq + truefalse
    // questionId -> marks given by the teacher for short answers
    shortMarks: { type: Map, of: Number, default: {} },
    totalMarks: { type: Number, default: 0 },
    needsReview: { type: Boolean, default: false }, // short answers waiting for the teacher
  },
  { timestamps: true }
);

attemptSchema.index({ student: 1, exam: 1 });

// A student can have only one in-progress attempt per exam
attemptSchema.index(
  { student: 1, exam: 1 },
  { unique: true, partialFilterExpression: { status: "in_progress" } }
);

module.exports = mongoose.model("Attempt", attemptSchema);