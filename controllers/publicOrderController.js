import Order from "../models/Order.js";
import User from "../models/User.js";
import { getActiveDriversMap } from "../socket/socketHandler.js";
import { haversineDistance } from "../utils/geoUtils.js";
import { generateOrderNumber } from "../utils/generateNumber.js";
const DRIVERS_POOL_ROOM = "drivers-pool"; 


// =======================================
// SUBMIT ORDER
// =======================================

export const submitOrder = async (req, res) => {
  try {

    const existingOrder = await Order.findOne({
      "customer.phone": req.body.customer.phone,
      status: { $in: ["received", "in_transit"] }
    });

    if (existingOrder) {
      return res.status(400).json({
        error: "You already have an active order",
        order_number: existingOrder.order_number
      });
    }

    const orderData = { ...req.body, order_number: generateOrderNumber() };
    const newOrder = await Order.create(orderData);

    const activeDriversMap = getActiveDriversMap();
    const driverIds = Array.from(activeDriversMap.keys());

    let closestDriver = null;

    if (driverIds.length > 0) {
      const drivers = await User.find({ 
        _id: { $in: driverIds },
        role: "staff",
        availability: true
      }).select("coords");

      let minDistance = Infinity;

      drivers.forEach(driver => {
        if (!driver.coords) return;
        const distance = haversineDistance(newOrder.customer.coords, driver.coords);
        if (distance < minDistance) {
          minDistance = distance;
          closestDriver = driver;
        }
      });

      if (closestDriver) {
        newOrder.assigned_staff_id = closestDriver._id;
        newOrder.status = "in_transit";
        await newOrder.save();

        const io = req.app.get("io");
        const driverSocketId = activeDriversMap.get(closestDriver._id.toString());
        if (io && driverSocketId) {
          io.to(driverSocketId).emit("new-order-assigned", {
            order_number: newOrder.order_number,
            customer: newOrder.customer,
            type_of_item: newOrder.type_of_item
          });
        }

        driverIds.forEach(driverId => {
          if (driverId === closestDriver._id.toString()) return; // استثناء الأقرب
          const socketId = activeDriversMap.get(driverId);
          if (io && socketId) {
            io.to(socketId).emit("new-order", {
              order_number: newOrder.order_number,
              type_of_item: newOrder.type_of_item,
              customer_address: newOrder.customer.address,
              customer_coords: newOrder.customer.coords,
            });
          }
        });
      }
    }

    res.status(201).json({ 
      message: "Order submitted successfully", 
      order: { order_number: newOrder.order_number } 
    });

  } catch (error) {
    console.error("❌ CRITICAL SUBMISSION ERROR:", error);
    res.status(500).json({ error: "Failed to submit order", details: error.message });
  }
};




export const trackOrder = async (req, res) => {
    try {
        const { order_number } = req.params;

        const order = await Order.findOne({ order_number });

        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }

        res.json({
            order_number: order.order_number,
            status: order.status,
            assigned_staff_id: order.assigned_staff_id,
            tracked_location: order.tracked_location,
            customer: {
                name: order.customer.name,
                phone: order.customer.phone,
                address: order.customer.address,
                coords: order.customer.coords, 
            },
            type_of_item: order.type_of_item,
            created_at: order.createdAt,
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

