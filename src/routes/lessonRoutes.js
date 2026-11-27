const express = require("express");
const {
  createLesson,
  getLessonTitles,
  getLessonsForWatching,
} = require("../controllers/lessonController");
const { protect, authorize } = require("../middleware/authMiddleware");

// mergeParams lets this router read :courseId from the parent path
const router = express.Router({ mergeParams: true });

router.get("/", getLessonTitles);
router.get("/watch", protect, getLessonsForWatching);
router.post("/", protect, authorize("admin"), createLesson);

module.exports = router;