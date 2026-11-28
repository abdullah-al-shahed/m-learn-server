const mongoose = require("mongoose");
const Exam = require("../models/Exam");
const Question = require("../models/Question");
const Attempt = require("../models/Attempt");

// null while short answers are still waiting for the teacher
const passedOf = (score, passMarks, needsReview) =>
  needsReview ? null : score >= passMarks;

// Detailed result of one attempt
const buildResult = async (attempt, showCorrect) => {
  const exam = await Exam.findById(attempt.exam).select("title passMarks endAt");
  const questions = await Question.find({ _id: { $in: attempt.questionOrder } });
  const byId = new Map(questions.map((q) => [String(q._id), q]));

  const items = attempt.questionOrder
    .map((id) => byId.get(String(id)))
    .filter(Boolean)
    .map((q) => {
      const id = String(q._id);
      const yourAnswer = attempt.answers.get(id) ?? "";

      let marksObtained;
      if (q.type === "short") {
        // null means: answered, waiting for the teacher
        marksObtained = attempt.shortMarks.has(id)
          ? attempt.shortMarks.get(id)
          : yourAnswer
          ? null
          : 0;
      } else {
        const isCorrect = String(yourAnswer).trim().toLowerCase() === q.correctAnswer;
        marksObtained = isCorrect ? q.marks : 0;
      }

      return {
        questionId: q._id,
        text: q.text,
        type: q.type,
        options: q.options,
        marks: q.marks,
        yourAnswer,
        marksObtained,
        correctAnswer: showCorrect ? q.correctAnswer : undefined,
      };
    });

  return {
    attemptId: attempt._id,
    exam: { _id: exam._id, title: exam.title, passMarks: exam.passMarks },
    submittedAt: attempt.submittedAt,
    score: attempt.score,
    totalMarks: attempt.totalMarks,
    needsReview: attempt.needsReview,
    passed: passedOf(attempt.score, exam.passMarks, attempt.needsReview),
    correctAnswersVisible: showCorrect,
    questions: items,
  };
};

// Student: list my submitted attempts
const getMyAttempts = async (req, res) => {
  try {
    const attempts = await Attempt.find({
      student: req.user._id,
      status: "submitted",
    })
      .populate("exam", "title passMarks")
      .sort({ submittedAt: -1 })
      .select("exam score totalMarks needsReview submittedAt");

    const results = attempts.map((a) => ({
      attemptId: a._id,
      exam: a.exam,
      score: a.score,
      totalMarks: a.totalMarks,
      needsReview: a.needsReview,
      passed: a.exam ? passedOf(a.score, a.exam.passMarks, a.needsReview) : null,
      submittedAt: a.submittedAt,
    }));

    res.json({ count: results.length, results });
  } catch (error) {
    console.error("Get my attempts error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Student: detailed result (correct answers only after the exam closes)
const getMyResult = async (req, res) => {
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
    if (attempt.status !== "submitted") {
      return res.status(400).json({ message: "Submit the attempt first" });
    }

    const exam = await Exam.findById(attempt.exam).select("endAt");
    const showCorrect = new Date() >= exam.endAt;

    res.json(await buildResult(attempt, showCorrect));
  } catch (error) {
    console.error("Get result error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Admin: all submitted attempts of an exam, ?needsReview=true to filter
const getExamAttempts = async (req, res) => {
  try {
    const { examId } = req.params;
    if (!mongoose.isValidObjectId(examId)) {
      return res.status(404).json({ message: "Exam not found" });
    }

    const exam = await Exam.findById(examId).select("title passMarks totalMarks");
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    const filter = { exam: exam._id, status: "submitted" };
    if (req.query.needsReview === "true") filter.needsReview = true;

    const attempts = await Attempt.find(filter)
      .populate("student", "name phone email")
      .sort({ score: -1 })
      .select("student score totalMarks needsReview submittedAt");

    const results = attempts.map((a) => ({
      attemptId: a._id,
      student: a.student,
      score: a.score,
      totalMarks: a.totalMarks,
      needsReview: a.needsReview,
      passed: passedOf(a.score, exam.passMarks, a.needsReview),
      submittedAt: a.submittedAt,
    }));

    res.json({ exam, count: results.length, results });
  } catch (error) {
    console.error("Get exam attempts error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Admin: one student's answer sheet with correct answers
const reviewAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;
    if (!mongoose.isValidObjectId(attemptId)) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    const attempt = await Attempt.findById(attemptId).populate(
      "student",
      "name phone email"
    );
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }
    if (attempt.status !== "submitted") {
      return res.status(400).json({ message: "Attempt is not submitted yet" });
    }

    const result = await buildResult(attempt, true);
    res.json({ student: attempt.student, ...result });
  } catch (error) {
    console.error("Review attempt error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Admin: give marks for short answers, e.g. { "marks": { "QUESTION_ID": 4 } }
const setShortMarks = async (req, res) => {
  try {
    const { attemptId } = req.params;
    if (!mongoose.isValidObjectId(attemptId)) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    const attempt = await Attempt.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }
    if (attempt.status !== "submitted") {
      return res.status(400).json({ message: "Attempt is not submitted yet" });
    }

    const incoming = req.body && req.body.marks;
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
      return res.status(400).json({ message: "marks must be an object" });
    }

    const shortQuestions = await Question.find({
      _id: { $in: attempt.questionOrder },
      type: "short",
    });
    const byId = new Map(shortQuestions.map((q) => [String(q._id), q]));

    const set = {};
    for (const [questionId, value] of Object.entries(incoming)) {
      const question = byId.get(questionId);
      if (!question) {
        return res
          .status(400)
          .json({ message: `Not a short question of this attempt: ${questionId}` });
      }
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0 || number > question.marks) {
        return res.status(400).json({
          message: `Marks must be between 0 and ${question.marks}`,
        });
      }
      set[`shortMarks.${questionId}`] = number;
    }

    if (Object.keys(set).length === 0) {
      return res.status(400).json({ message: "No marks provided" });
    }

    await Attempt.updateOne({ _id: attempt._id }, { $set: set });

    // Recalculate the total and whether anything is still waiting
    const fresh = await Attempt.findById(attempt._id);
    let shortTotal = 0;
    for (const value of fresh.shortMarks.values()) shortTotal += value;

    let needsReview = false;
    for (const q of shortQuestions) {
      const id = String(q._id);
      if (fresh.answers.get(id) && !fresh.shortMarks.has(id)) needsReview = true;
    }

    const score = fresh.autoScore + shortTotal;
    await Attempt.updateOne({ _id: fresh._id }, { $set: { score, needsReview } });

    res.json({ message: "Marks saved", score, totalMarks: fresh.totalMarks, needsReview });
  } catch (error) {
    console.error("Set short marks error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

module.exports = {
  getMyAttempts,
  getMyResult,
  getExamAttempts,
  reviewAttempt,
  setShortMarks,
};