const express = require("express");
const {
  saveAnswers,
  submitAttempt,
} = require("../controllers/attemptController");
const {
  getMyAttempts,
  getMyResult,
  reviewAttempt,
  setShortMarks,
} = require("../controllers/resultController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// Student
router.get("/my", protect, authorize("student"), getMyAttempts);
router.patch("/:attemptId/answers", protect, authorize("student"), saveAnswers);
router.post("/:attemptId/submit", protect, authorize("student"), submitAttempt);
router.get("/:attemptId/result", protect, authorize("student"), getMyResult);

// Admin
router.get("/:attemptId/review", protect, authorize("admin"), reviewAttempt);
router.patch(
  "/:attemptId/short-marks",
  protect,
  authorize("admin"),
  setShortMarks
);

module.exports = router;