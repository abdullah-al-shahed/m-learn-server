const express = require("express");
const {
  createQuestion,
  getExamQuestions,
  updateQuestion,
  deleteQuestion,
} = require("../controllers/questionController");
const { protect, authorize } = require("../middleware/authMiddleware");

// mergeParams lets this router read :examId from the parent path
const router = express.Router({ mergeParams: true });

router.use(protect, authorize("admin"));

router.get("/", getExamQuestions);
router.post("/", createQuestion);
router.patch("/:id", updateQuestion);
router.delete("/:id", deleteQuestion);

module.exports = router;