require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");


const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Mamun's Learning Academy server is running" });
});

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/courses", require("./routes/courseRoutes"));
app.use("/api/courses/:courseId/lessons", require("./routes/lessonRoutes"));
app.use("/api/enrollments", require("./routes/enrollmentRoutes"));
app.use("/api/exams", require("./routes/examRoutes"));
app.use("/api/exams/:examId/questions", require("./routes/questionRoutes"));
app.use("/api/attempts", require("./routes/attemptRoutes"));

const { finalizeExpiredAttempts } = require("./controllers/attemptController");

// Connect to database, then start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Every minute, submit attempts whose time has run out
  setInterval(() => {
    finalizeExpiredAttempts().catch((error) =>
      console.error("Auto-submit error:", error.message)
    );
  }, 60 * 1000);
});