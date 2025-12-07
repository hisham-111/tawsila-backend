import Order from "../models/Order.js";
import User from "../models/User.js";
import { getActiveDriversMap } from "../sockets/driverSockets.js";


// 🚨 الحل: تعريف الثابت المفقود هنا ليصبح متاحًا داخل الدوال
const DRIVERS_POOL_ROOM = "drivers-pool"; 

const generateOrderNumber = () => {
    // Generate a unique-ish string: Timestamp (last 10 digits) + a 4-digit random number
    const timestampPart = Date.now().toString().slice(-10);
    const randomPart = Math.floor(Math.random() * 9000) + 1000;
    return `ORD-${timestampPart}-${randomPart}`;
};
// =======================================
// SUBMIT ORDER
// =======================================


// export const submitOrder = async (req, res) => {
//     try { 
//         const orderData = {
//             ...req.body,
//             order_number: generateOrderNumber(), // استخدام الدالة المخصصة
//         };

//         const newOrder = await Order.create(orderData);

//         // 2. Notify ALL active drivers via Socket.IO (Broadcast to the pool)
//         const io = req.app.get("io");
        
//         if (io) {
//             // الآن DRIVERS_POOL_ROOM مُعرّف ولن يسبب خطأ
//             io.to(DRIVERS_POOL_ROOM).emit("new-order", {
//                 order_number: newOrder.order_number,
//                 type_of_item: newOrder.type_of_item,
//                 customer_address: newOrder.customer.address,
//                 customer_coords: newOrder.customer.coords,
//             });

//             console.log(`✅ Sent new order ${newOrder.order_number} to all active drivers in the pool.`);
//         } else {
//             console.log(`⚠️ Socket.IO not initialized. Order ${newOrder.order_number} submitted but not broadcasted.`);
//         }

//         // 3. Return success response
//         res.status(201).json({
//             message: "Order submitted successfully",
//             order: { order_number: newOrder.order_number },
//         });

//     } catch (error) {
//         console.error("❌ CRITICAL SUBMISSION ERROR:", error);

//         // 💡 منطق محسّن للتعامل مع أخطاء التحقق من صحة البيانات
//         if (error.name === "ValidationError") {
//             // إرجاع 400 (Bad Request) لأخطاء البيانات المدخلة
//             return res.status(400).json({ error: "Validation Failed", details: error.message });
//         }
        
//         // إرجاع 500 لأخطاء الخادم الأخرى
//         res.status(500).json({ error: "Failed to process order submission due to a server error.", details: error.message });
//     }
// };


// دالة لحساب المسافة الجغرافية (خط مستقيم)


const haversineDistance = (coords1, coords2) => {
  const toRad = deg => deg * Math.PI / 180;
  const R = 6371; // km
  const dLat = toRad(coords2.lat - coords1.lat);
  const dLng = toRad(coords2.lng - coords1.lng);
  const a = 
    Math.sin(dLat/2) ** 2 +
    Math.cos(toRad(coords1.lat)) * Math.cos(toRad(coords2.lat)) * Math.sin(dLng/2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // distance in km
};

export const submitOrder = async (req, res) => {
  try {
    const orderData = { ...req.body, order_number: generateOrderNumber() };
    const newOrder = await Order.create(orderData);

    const activeDriversMap = getActiveDriversMap();
    const driverIds = Array.from(activeDriversMap.keys());

    let closestDriver = null;

    if (driverIds.length > 0) {
      // جلب السائقين المتاحين
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
        // تحديث الطلب بالسائق الأقرب
        newOrder.assigned_staff_id = closestDriver._id;
        newOrder.status = "in_transit";
        await newOrder.save();

        // إخطار السائق الأقرب فقط
        const io = req.app.get("io");
        const driverSocketId = activeDriversMap.get(closestDriver._id.toString());
        if (io && driverSocketId) {
          io.to(driverSocketId).emit("new-order-assigned", {
            order_number: newOrder.order_number,
            customer: newOrder.customer,
            type_of_item: newOrder.type_of_item
          });
        }

        // إخطار بقية السائقين مع استثناء السائق الأقرب
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

