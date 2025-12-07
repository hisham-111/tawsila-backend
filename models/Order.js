// src/models/Order.js
import mongoose from "mongoose";

const { Schema, model, Types } = mongoose;

const orderSchema = new Schema({
  order_number: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },

  customer: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String },

   coords: { 
      lat: { type: Number, required: true }, 
      lng: { type: Number, required: true },
     }
   },

  assigned_staff_id: {
    type: Types.ObjectId,
    ref: "User",
  },

  // status: {
  // type: String,
  //  enum: ["received", "in_transit", "delivered"],
  //  default: "received",
  // },

   status: {
        type: String,
        enum: ["received", "in_transit", "delivered"],
        default: "received",
        // 💡 إضافة فهرس لتحسين أداء البحث عن الطلبات المتاحة
        index: true, 
    },

  type_of_item: { type: String },

  rating: { type: Number, min: 1, max: 5 },


  tracked_location: {
   lat: Number, // لا يشترط required هنا إذا كان قد لا يتوفر عند الإنشاء
   lng: Number,
    time: { type: Date, default: Date.now }, // إضافة حقل الوقت
  },
}, { timestamps: true });

export default model("Order", orderSchema);
