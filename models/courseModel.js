// backend/models/courseModel.js
import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  options: {
    type: [String],
    validate: v => v.length === 4, // exactly 4 options
    required: true
  },
  correctIndex: {
    type: Number,
    min: 0, max: 3,
    required: true
  }
}, { _id: false });

const courseSchema = new mongoose.Schema({
  courseName: { type: String, required: true },
  price: { type: Number, min: 0 },
  thumbnailUrl: { type: String },       // image
  videoUrl: { type: String },           // video (Cloudinary/S3)
  pptUrl: { type: String },             // PPT (Drive/S3)
  description: { type: String },
  certificateTemplateUrl: { type: String, required: true }, // uploaded by Lecture
  questions: { type: [questionSchema], default: [] },       // MCQ
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

export const Course = mongoose.model("Course", courseSchema);
