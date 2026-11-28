const mongoose = require("mongoose");
const Exam = require("../models/Exam");
const Question = require("../models/Question");
const Attempt = require("../models/Attempt");

// Fisher-Yates shuffle (returns a new array)
const shuffle = (array) => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

// What the student receives: questions WITHOUT correct answers
const buildPayload = async (attempt) => {
  const questions = await Question.find({
    _id: { $in: attempt.questionOrder },
  }).select("text type options marks");

  const byId = new Map(questions.map((q) => [String(q._id), q]));
  const ordered = attempt.questionOrder
    .map((id) => byId.get(String(id)))
    .filter(Boolean);

  return {
    attemptId: attempt._id,
    startedAt: attempt.startedAt,
    endsAt: attempt.endsAt,
    serverTime: new Date(),
    answers: Object.fromEntries(attempt.answers),
    questions: ordered,
  };
};

// Student: start an exam, or resume an unfinished attempt
const startExam = async (req, res) => {
  try {
    const { examId } = req.params;
    if (!mongoose.isValidObjectId(examId)) {
      return res.status(404).json({ message: "Exam not found" });
    }

    const exam = await Exam.findById(examId);
    if (!exam || !exam.isPublished) {
      return res.status(404).json({ message: "Exam not found" });
    }

    const now = new Date();
    if (now < exam.startAt) {
      return res.status(400).json({ message: "This exam has not started yet" });
    }
    if (now >= exam.endAt) {
      return res.status(400).json({ message: "This exam has ended" });
    }

    // Resume an unfinished attempt
    const running = await Attempt.findOne({
      student: req.user._id,
      exam: exam._id,
      status: "in_progress",
    });
    if (running) {
      if (running.endsAt <= now) {
        return res
          .status(400)
          .json({ message: "Your time for this attempt is over" });
      }
      return res.json({
        message: "Resuming your attempt",
        ...(await buildPayload(running)),
      });
    }

    const used = await Attempt.countDocuments({
      student: req.user._id,
      exam: exam._id,
    });
    if (used >= exam.attemptLimit) {
      return res
        .status(403)
        .json({ message: "You have no attempts left for this exam" });
    }

    const questions = await Question.find({ exam: exam._id }).select("_id");
    if (questions.length === 0) {
      return res
        .status(400)
        .json({ message: "This exam has no questions yet" });
    }

    // The attempt ends at the duration limit or the exam close time, whichever is first
    const endsAt = new Date(
      Math.min(now.getTime() + exam.durationMin * 60 * 1000, exam.endAt.getTime())
    );

    const attempt = await Attempt.create({
      student: req.user._id,
      exam: exam._id,
      questionOrder: shuffle(questions.map((q) => q._id)),
      startedAt: now,
      endsAt,
    });

    res.status(201).json({
      message: "Exam started",
      ...(await buildPayload(attempt)),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "Your attempt is already starting. Please try again." });
    }
    console.error("Start exam error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

module.exports = { startExam };