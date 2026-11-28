const mongoose = require("mongoose");
const Exam = require("../models/Exam");
const Question = require("../models/Question");

// Recalculates the exam's totalMarks from its questions
const recalcTotalMarks = async (examId) => {
  const result = await Question.aggregate([
    { $match: { exam: new mongoose.Types.ObjectId(examId) } },
    { $group: { _id: null, total: { $sum: "$marks" } } },
  ]);
  const total = result.length ? result[0].total : 0;
  await Exam.findByIdAndUpdate(examId, { totalMarks: total });
};

// Checks type-specific rules and returns cleaned values or { error }
const normalize = ({ type, options, correctAnswer }) => {
  if (type === "mcq") {
    if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
      return { error: "MCQ needs 2 to 6 options" };
    }
    const cleaned = options.map((o) => String(o).trim());
    if (cleaned.some((o) => !o)) {
      return { error: "Options cannot be empty" };
    }
    const index = Number(correctAnswer);
    if (!Number.isInteger(index) || index < 0 || index >= cleaned.length) {
      return {
        error:
          "correctAnswer must be the index of the correct option, starting from 0",
      };
    }
    return { options: cleaned, correctAnswer: String(index) };
  }

  if (type === "truefalse") {
    const value = String(correctAnswer).toLowerCase();
    if (!["true", "false"].includes(value)) {
      return { error: 'correctAnswer must be "true" or "false"' };
    }
    return { options: [], correctAnswer: value };
  }

  if (type === "short") {
    return {
      options: [],
      correctAnswer: correctAnswer ? String(correctAnswer).trim() : "",
    };
  }

  return { error: "Type must be mcq, truefalse or short" };
};

const findExam = async (examId) => {
  if (!mongoose.isValidObjectId(examId)) return null;
  return Exam.findById(examId);
};

// Admin: add a question to an exam
const createQuestion = async (req, res) => {
  try {
    const exam = await findExam(req.params.examId);
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    const { text, type, options, correctAnswer, marks } = req.body || {};
    if (!text || !type) {
      return res.status(400).json({ message: "Text and type are required" });
    }

    const cleaned = normalize({ type, options, correctAnswer });
    if (cleaned.error) {
      return res.status(400).json({ message: cleaned.error });
    }

    const question = await Question.create({
      exam: exam._id,
      text,
      type,
      options: cleaned.options,
      correctAnswer: cleaned.correctAnswer,
      marks,
    });

    await recalcTotalMarks(exam._id);
    res.status(201).json({ message: "Question added", question });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    console.error("Create question error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Admin: list all questions of an exam (with correct answers)
const getExamQuestions = async (req, res) => {
  try {
    const exam = await findExam(req.params.examId);
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    const questions = await Question.find({ exam: exam._id }).sort({
      createdAt: 1,
    });
    res.json({ count: questions.length, totalMarks: exam.totalMarks, questions });
  } catch (error) {
    console.error("Get questions error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Admin: edit a question
const updateQuestion = async (req, res) => {
  try {
    const { examId, id } = req.params;
    if (!mongoose.isValidObjectId(examId) || !mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Question not found" });
    }

    const question = await Question.findOne({ _id: id, exam: examId });
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    const body = req.body || {};

    const cleaned = normalize({
      type: body.type ?? question.type,
      options: body.options ?? question.options,
      correctAnswer: body.correctAnswer ?? question.correctAnswer,
    });
    if (cleaned.error) {
      return res.status(400).json({ message: cleaned.error });
    }

    question.type = body.type ?? question.type;
    question.options = cleaned.options;
    question.correctAnswer = cleaned.correctAnswer;
    if (body.text !== undefined) question.text = body.text;
    if (body.marks !== undefined) question.marks = body.marks;

    await question.save();
    await recalcTotalMarks(examId);

    res.json({ message: "Question updated", question });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    console.error("Update question error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Admin: delete a question
const deleteQuestion = async (req, res) => {
  try {
    const { examId, id } = req.params;
    if (!mongoose.isValidObjectId(examId) || !mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Question not found" });
    }

    const question = await Question.findOneAndDelete({ _id: id, exam: examId });
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    await recalcTotalMarks(examId);
    res.json({ message: "Question deleted" });
  } catch (error) {
    console.error("Delete question error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

module.exports = {
  createQuestion,
  getExamQuestions,
  updateQuestion,
  deleteQuestion,
};