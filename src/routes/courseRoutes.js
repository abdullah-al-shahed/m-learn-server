const express = require("express");
const {
  createCourse,
  getCourses,
  getCourseById,
} = require("../controllers/courseController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", getCourses);
router.get("/:id", getCourseById);
router.post("/", protect, authorize("admin"), createCourse);

module.exports = router;