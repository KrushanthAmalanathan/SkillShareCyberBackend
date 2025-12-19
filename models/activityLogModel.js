// activityLogModel.js
import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: [
        "Template Added",
        "Template Updated",
        "Template Deleted",
        "Product Added",
        "Product Updated",
        "Product Deleted",
        "Page Viewed",
      ],
    },
    description: {
      type: String,
    },
    userEmail: {
      type: String,
    },
    userName: {
      type: String,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

export const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);
