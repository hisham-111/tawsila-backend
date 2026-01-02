import Order from "../models/Order.js";
import User from "../models/User.js"; 
import { activeDrivers } from '../socket/socketStore.js';
import axios from 'axios';




// ===========================
// GET ALL ORDERS
// ===========================
export const getOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("assigned_staff_id", "-password -token"); // never expose sensitive data

    res.status(200).json(orders);
  } catch (err) {
    console.error("GET ORDERS ERROR:", err);
    res.status(500).json({ error: "Server error while fetching orders" });
  }
};


// ===========================
// GET SINGLE ORDER
// ===========================
export const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("customer_id", "-password")
      .populate("assigned_staff_id", "-password");

    if (!order) return res.status(404).json({ error: "Order not found" });

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getStartDate = (range) => {
  const now = new Date();
  let startDate = new Date(now); // نسخ التاريخ الحالي

  switch (range) {
    case "daily":
      startDate.setHours(0,0,0,0);
      break;
    case "weekly":
      startDate.setDate(startDate.getDate() - 6); // آخر 7 أيام
      startDate.setHours(0,0,0,0);
      break;
    case "monthly":
      startDate.setDate(1); // بداية الشهر الحالي
      startDate.setHours(0,0,0,0);
      break;
    default:
      startDate = new Date(0); // fallback
  }
  return startDate;
};


export const getOrdersByRange = async (req, res) => {
  try {
    const { range } = req.query;
    const startDate = getStartDate(range);

    const stats = await Order.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { date: "$_id", orders: 1, _id: 0 } }
    ]);

    res.json(stats);
  } catch (error) {
    console.error("❌ Error loading range stats:", error);
    res.status(500).json({ error: "Failed to load statistics" });
  }
};


export const getPlacesStats = async (req, res) => {
  try {
    const { range } = req.query;
    const startDate = getStartDate(range);

    const results = await Order.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: "$customer.address",
          deliveries: { $sum: 1 }
        }
      },
      {
        $project: { city: "$_id", deliveries: 1, _id: 0 }
      }
    ]);

    res.json(results);
  } catch (error) {
    console.error("❌ Stats error:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
};

// ===========================
// GET PLACES STATS
// ===========================
// export const getPlacesStats = async (req, res) => {
//   try {
//     const { range } = req.query;

//     let startDate = new Date();

//     if (range === "daily") {
//       startDate.setHours(0, 0, 0, 0);
//     } else if (range === "weekly") {
//       startDate.setDate(startDate.getDate() - 7);
//     } else if (range === "monthly") {
//       startDate.setMonth(startDate.getMonth() - 1);
//     }

//     const results = await Order.aggregate([
//       {
//         $match: {
//           createdAt: { $gte: startDate }
//         }
//       },
//       {
//         $group: {
//           _id: "$customer.address",
//           deliveries: { $sum: 1 }
//         }
//       },
//       {
//         $project: {
//           city: "$_id",
//           deliveries: 1,
//           _id: 0
//         }
//       }
//     ]);

//     res.json(results);

//   } catch (error) {
//     console.log("❌ Stats error:", error);
//     res.status(500).json({ error: "Failed to fetch statistics" });
//   }
// };




// ===========================
// GET Orders STATS
// ===========================
// export const getOrdersByRange = async (req, res) => {
//   try {
//     const { range } = req.query;

//     let startDate = new Date();

//     if (range === "daily") {
//       startDate.setHours(0, 0, 0, 0);
//     } 
//     else if (range === "weekly") {
//       startDate.setDate(startDate.getDate() - 7);
//     } 
//     else if (range === "monthly") {
//       startDate.setMonth(startDate.getMonth() - 1);
//     }

//     const stats = await Order.aggregate([
//       {
//         $match: {
//           createdAt: { $gte: startDate }
//         }
//       },
//       {
//         $group: {
//           _id: {
//             $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
//           },
//           orders: { $sum: 1 }
//         }
//       },
//       {
//         $sort: { _id: 1 }
//       },
//       {
//         $project: {
//           date: "$_id",
//           orders: 1,
//           _id: 0
//         }
//       }
//     ]);

//     res.json(stats);

//   } catch (error) {
//     console.error("❌ Error loading range stats:", error);
//     res.status(500).json({ error: "Failed to load statistics" });
//   }
// };



// ===========================
// UPDATE ORDER
// ===========================
// export const updateOrder = async (req, res) => {
//   try {
//     const order = await Order.findByIdAndUpdate(
//       req.params.id,
//       req.body,
//       { new: true } // return updated document
//     ).populate("assigned_staff_id", "-password -token");

//     if (!order) return res.status(404).json({ error: "Order not found" });

//     res.status(200).json({ message: "Order updated successfully", order });
//   } catch (err) {
//     console.error("UPDATE ORDER ERROR:", err);
//     res.status(500).json({ error: "Server error while updating order" });
//   }
// };

export const updateOrder = async (req, res) => {
  try {
    const { status } = req.body;

    // إذا تم إرسال status
    if (status === "cancelled") {
      req.body.cancelledAt = new Date(); // ضع التاريخ الحالي
    } else {
      req.body.cancelledAt = null; // أي تغيير آخر يمسح التاريخ
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate("assigned_staff_id", "-password -token");

    if (!order) return res.status(404).json({ error: "Order not found" });

    res.status(200).json({ message: "Order updated successfully", order });
  } catch (err) {
    console.error("UPDATE ORDER ERROR:", err);
    res.status(500).json({ error: "Server error while updating order" });
  }
};



// ===========================
// DELETE ORDER
// ===========================
export const deleteOrder = async (req, res) => {
  console.log("Received delete request for ID:", req.params.id);
  console.log("Request user:", req.user); // Check role
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.status(200).json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error("DELETE ORDER ERROR:", err);
    res.status(500).json({ error: "Server error while deleting order" });
  }
};





// ===========================
// SUBMIT ORDER RATING (Save to DB) ⭐️
// ===========================
// Assuming this function is in your orderController.js

export const submitOrderRating = async (req, res) => {
    console.log("ATTEMPTING TO SUBMIT RATING:", req.params.orderId);
    
    try {
        const { orderId } = req.params;
        const { rating } = req.body;

        // 1. Validation 
        // (Assuming validation for null, NaN, and range 1-5 is present)
        const numericRating = Number(rating);
        
        // 2. Find and update the order
        const order = await Order.findOneAndUpdate(
            // Query Conditions (All must be true for update to succeed):
            { 
                order_number: orderId, 
                // 🔑 FIX: Changed status to "Delivered" to match database casing.
                status: "Delivered", 
                rating: { $exists: false } // Must NOT have a rating yet
            }, 
            { rating: numericRating },
            { new: true, runValidators: true }
        ).select("order_number rating customer.name assigned_staff_id"); 

        if (!order) {
            // The 404 response is correct if the order doesn't meet the criteria.
            return res.status(404).json({ 
                error: "Order not found, or it has already been rated, or it is not marked as delivered." 
            });
        }
        
        // Success response
        res.json({ 
            message: `Rating of ${numericRating} saved successfully for order ${order.order_number}`,
            order: order
        });

    } catch (err) {
        console.error("SUBMIT RATING ERROR:", err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: "Server error during rating submission" });
    }
};





// ===========================
// DRIVER - ACCEPT ORDER 🟢
// ===========================


export const acceptOrder = async (req, res) => {
    try {
        const { order_number, driver_id } = req.body;

        const order = await Order.findOneAndUpdate(
            { order_number, status: 'received' }, 
            {
                status: 'in_transit',
                assigned_staff_id: driver_id,
            },
            { new: true }
        );

        if (!order) {
            // يتم إرجاع هذا إذا لم يتم العثور على الطلب أو كانت حالته ليست 'received' (أي تم قبوله من سائق آخر)
            return res.status(409).json({ error: "Order not found or already assigned/accepted." });
        }

        // 2. Notify ALL drivers that the order is no longer available
        if (req.app.get("io")) {
            req.app.get("io").emit("order-accepted", { order_number: order.order_number });
            
            // 3. Notify the customer that a driver has been assigned (افتراضاً أن العميل في غرفة بنفس رقم الطلب)
            req.app.get("io").to(order.order_number).emit("status-update", { 
                status: 'in_transit', 
                driver_id: driver_id,
                driver_phone: "DRIVER_PHONE_PLACEHOLDER" // يجب جلب رقم هاتف السائق من DB
            });
        }

        res.json({ message: "Order accepted successfully", order });

    } catch (err) {
        console.error("❌ Error accepting order:", err.message);
        res.status(500).json({ error: "Failed to accept order", details: err.message });
    }
};


export const getAvailableOrders = async (req, res) => {
    try {
        // 🚨 ملاحظة: يمكنك إضافة منطق بحث جغرافي هنا (مثلاً: within 10km of driver's location)
        // حالياً، سنبحث عن جميع الطلبات الجديدة (received).
        const availableOrders = await Order.find({ status: "received" })
            .select("order_number customer.address customer.coords type_of_item createdAt") // اختيار الحقول الضرورية فقط
            .sort({ createdAt: -1 }); // ترتيبها من الأحدث للأقدم

        res.json({
            message: "Available orders retrieved successfully.",
            orders: availableOrders
        });

    } catch (error) {
        console.error("❌ Error fetching available orders:", error);
        res.status(500).json({ error: "Failed to fetch available orders.", details: error.message });
    }
};

// =======================================
// UPDATE DRIVER LOCATION (POST /driver/location/update)
// =======================================

export const updateDriverLocation = async (req, res) => {
    try {
        const { driver_id, lat, lng } = req.body;

        // 1. تحديث موقع السائق في قاعدة بيانات المستخدمين (افتراضي: User model)

        // 2. البحث عن الطلبات التي تم تعيينها لهذا السائق والتي حالتها 'in_transit'
        const orders = await Order.find({ assigned_staff_id: driver_id, status: 'in_transit' })
                                  .select("order_number");

        if (req.app.get("io")) {
            // 3. البث إلى غرف العملاء المتأثرين (كل عميل في غرفة برقم طلبه)
            orders.forEach(order => {
                req.app.get("io").to(order.order_number).emit("driver-location-update", {
                    lat, 
                    lng, 
                    time: new Date() 
                });
            });
        }

        res.json({ message: "Location updated and broadcasted successfully" });
    } catch (error) {
        console.error("❌ Error updating driver location:", error.message);
        res.status(500).json({ error: "Failed to update location", details: error.message });
    }
};


  
// ============ calculateRouteInfo  ============


export const calculateRouteInfo = async (req, res) => {
    const { origin, destination } = req.body;

    if (!origin || !destination) {
        return res.status(400).json({ success: false, error: "Missing coordinates" });
    }

    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`;
        const response = await axios.get(url);
        const route = response.data.routes[0].legs[0];

        return res.json({
            success: true,
            distance: route.distance,
            duration: route.duration
        });

    } catch (error) {
        console.error("OSRM Error:", error.message);
        return res.status(500).json({ success: false, error: "Route calculation failed." });
    }
};


// ===========================
// CANCEL ORDER 🛑
// ===========================
export const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;

        // البحث عن الطلب والتحقق من أنه لم يتم إلغاؤه مسبقًا أو تسليمه
        const order = await Order.findOne({ order_number: orderId});

        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }

        if (order.status === "delivered") {
            return res.status(400).json({ error: "Cannot cancel a delivered order" });
        }

        if (order.status === "cancelled") {
            return res.status(400).json({ error: "Order is already cancelled" });
        }

        // تحديث حالة الطلب إلى cancelled وتسجيل الوقت
        order.status = "cancelled";
        order.cancelledAt = new Date();
        await order.save();

        // إعادة توافر السائق إذا تم تعيينه
        if (order.assigned_staff_id) {
            await User.findByIdAndUpdate(order.assigned_staff_id, { availability: true });
        }

        // إشعار العميل والسائق عبر Socket.io
        if (req.app.get("io")) {
            const io = req.app.get("io");
            io.to(order.order_number).emit("order-cancelled", {
                orderId: order._id,
                cancelledAt: order.cancelledAt,
            });

            if (order.assigned_staff_id) {
                const driverSocketId = activeDrivers.get(order.assigned_staff_id.toString());
                if (driverSocketId) {
                    io.to(driverSocketId).emit("order-cancelled", {
                        orderId: order._id,
                        cancelledAt: order.cancelledAt,
                    });
                }
            }
        }

        res.json({ message: "Order cancelled successfully", order });
    } catch (error) {
        console.error("❌ Error cancelling order:", error.message);
        res.status(500).json({ error: "Failed to cancel order", details: error.message });
    }
};
