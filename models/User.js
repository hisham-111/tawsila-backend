// src/models/User.js
import mongoose from "mongoose";

const { Schema, model } = mongoose;

const userSchema = new Schema({
  full_name: {
    type: String,
    required: [true, "Full name is required"],
    trim: true,
  },
  username: {
    type: String,
    required: [true, "Username is required"],
    unique: true,
    trim: true,
  },
  phone: {
    type: String,
    required: [true, "Phone number is required"],
    trim: true,
  },
  address: {
    type: String,
    trim: true,
  },
  role: {
    type: String,
    enum: ["admin", "staff"],
    required: [true, "Role is required"],
  },
  availability: {
    type: Boolean,
    default: true,
  },
  password: { 
    type: String, 
    required: true 
  },
}, { timestamps: true });


// Optional: virtual property for convenience
userSchema.virtual("isStaff").get(function () {
  return this.role === "staff";
});

// Include virtuals in JSON output
userSchema.set("toJSON", { virtuals: true });

export default model("User", userSchema);
