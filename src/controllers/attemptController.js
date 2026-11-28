const mongoose = require("mongoose");
const Exam = require("../models/Exam");
const Question = require("../models/Question");
const Attempt = require("../models/Attempt");

const GRACE_MS = 10 * 1000; // extra time allowed for slow networks
const MAX_ANSWER_LENGTH = 2000;
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

// Marks mcq and truefalse answers against the correct answers
const gradeAttempt = async (attempt) => {
  const questions = await Question.find({ _id: { $in: attempt.questionOrder } });

  let autoScore = 0;
  let totalMarks = 0;
  let needsReview = false;

  for (const q of questions) {
    totalMarks += q.marks;
    const given = attempt.answers.get(String(q._id));

    if (q.type === "short") {
      if (given) needsReview = true;
      continue;
    }

    if (given !== undefined && String(given).trim().toLowerCase() === q.correctAnswer) {
      autoScore += q.marks;
    }
  }

  return { autoScore, totalMarks, needsReview };
};

// Closes an attempt exactly once, even if called twice at the same time
const finalizeAttempt = async (attempt, submittedAt = new Date()) => {
  const { autoScore, totalMarks, needsReview } = await gradeAttempt(attempt);

  const updated = await Attempt.findOneAndUpdate(
    { _id: attempt._id, status: "in_progress" },
    {
      $set: {
        status: "submitted",
        submittedAt,
        autoScore,
        score: autoScore,
        totalMarks,
        needsReview,
      },
    },
    { new: true }
  );

  return updated || (await Attempt.findById(attempt._id));
};

// Submits every attempt whose time ran out (called every minute)
const finalizeExpiredAttempts = async () => {
  const expired = await Attempt.find({
    status: "in_progress",
    endsAt: { $lt: new Date(Date.now() - GRACE_MS) },
  }).limit(200);

  for (const attempt of expired) {
    await finalizeAttempt(attempt, attempt.endsAt);
  }
};

const summarize = (attempt) => ({
  attemptId: attempt._id,
  status: attempt.status,
  submittedAt: attempt.submittedAt,
  score: attempt.score,
  totalMarks: attempt.totalMarks,
  needsReview: attempt.needsReview,
});

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
      if (running.endsAt > now) {
        return res.json({
          message: "Resuming your attempt",
          ...(await buildPayload(running)),
        });
      }
      // Time ran out earlier without a submit: close it now and continue
      await finalizeAttempt(running, running.endsAt);
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

// Student: save answers (only the changed ones are needed)
const saveAnswers = async (req, res) => {
  try {
    const { attemptId } = req.params;
    if (!mongoose.isValidObjectId(attemptId)) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    const incoming = req.body && req.body.answers;
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
      return res.status(400).json({ message: "answers must be an object" });
    }

    const attempt = await Attempt.findOne({
      _id: attemptId,
      student: req.user._id,
    });
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }
    if (attempt.status !== "in_progress") {
      return res
        .status(400)
        .json({ message: "This attempt is already submitted" });
    }
    if (Date.now() > attempt.endsAt.getTime() + GRACE_MS) {
      return res.status(400).json({ message: "Time is over" });
    }

    const validIds = new Set(attempt.questionOrder.map(String));
    const set = {};
    const unset = {};

    for (const [questionId, value] of Object.entries(incoming)) {
      if (!validIds.has(questionId)) {
        return res.status(400).json({ message: "Unknown question in answers" });
      }
      const text = String(value ?? "");
      if (text.length > MAX_ANSWER_LENGTH) {
        return res.status(400).json({ message: "Answer is too long" });
      }
      if (text.trim() === "") {
        unset[`answers.${questionId}`] = ""; // empty answer clears it
      } else {
        set[`answers.${questionId}`] = text;
      }
    }

    const update = {};
    if (Object.keys(set).length) update.$set = set;
    if (Object.keys(unset).length) update.$unset = unset;

    if (Object.keys(update).length) {
      await Attempt.updateOne(
        { _id: attempt._id, status: "in_progress" },
        update
      );
    }

    res.json({ message: "Saved", savedAt: new Date() });
  } catch (error) {
    console.error("Save answers error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Student: submit the attempt and get the score
const submitAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;
    if (!mongoose.isValidObjectId(attemptId)) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    const attempt = await Attempt.findOne({
      _id: attemptId,
      student: req.user._id,
    });
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    // Safe to call twice (e.g. a retry after a slow network)
    if (attempt.status === "submitted") {
      return res.json({
        message: "Already submitted",
        result: summarize(attempt),
      });
    }

    const done = await finalizeAttempt(attempt);
    res.json({ message: "Submitted", result: summarize(done) });
  } catch (error) {
    console.error("Submit attempt error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};


module.exports = {
  startExam,
  saveAnswers,
  submitAttempt,
  finalizeExpiredAttempts,
};