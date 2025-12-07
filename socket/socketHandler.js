import Order from "../models/Order.js";
import User from "../models/User.js"; // لإحضار بيانات السائقين
import mongoose from "mongoose";

// استخدام Map لتخزين السائقين النشطين (DriverId -> SocketId)
const activeDrivers = new Map();

// الثابت الخاص بالغرفة يجب أن يكون متطابقًا مع orderController.js
const DRIVERS_POOL_ROOM = "drivers-pool"; 

export const initializeSocketListeners = (io) => {
    io.on("connection", (socket) => {

        // ============================
        // 1. Driver Joins (Registers in the map and joins the room)
        socket.on("driver-join", async (driverId, coords) => {
            if (!driverId) return;

            // الانضمام إلى الغرفة ليتم استقبال البث من submitOrder
            socket.join(DRIVERS_POOL_ROOM); 
            activeDrivers.set(driverId, socket.id);
            socket.data.driverId = driverId; // لتسهيل إزالة السائق عند الانفصال

            // تحديث إحداثيات السائق وتعيين availability = true
            try {
                if (coords?.lat && coords?.lng) {
                    await User.findByIdAndUpdate(driverId, { coords, availability: true });
                }
            } catch (err) {
                console.error(`Error updating driver ${driverId} coords:`, err);
            }

            console.log(`🚗 Driver joined: ${driverId} → socket ${socket.id} (Pool: ${DRIVERS_POOL_ROOM})`);
        });

        // ============================
        // 2. Customer Joins Order Room
        socket.on("join-order", async (orderId) => {
            if (!orderId) return;

            socket.join(orderId);
            console.log(`📦 Customer joined order room: ${orderId}`);

            // إرسال آخر موقع معروف فورًا
            try {
                const order = await Order.findOne({ order_number: orderId });
                if (order?.tracked_location) {
                    socket.emit("location-updated", {
                        lat: order.tracked_location.lat,
                        lng: order.tracked_location.lng,
                    });
                }
            } catch (error) {
                console.error("Error fetching order on join:", error);
            }
        });

        // ============================
        // 3. Driver Live Location Update
        socket.on("update-location", async ({ orderId, driverId, lat, lng }) => {
            if (!orderId || typeof lat !== 'number' || typeof lng !== 'number') {
                console.warn(`Invalid location data from Driver ${driverId}`);
                return;
            }

            // تحديث الموقع في DB
            Order.findOneAndUpdate(
                { order_number: orderId },
                { tracked_location: { lat, lng, time: Date.now() } }
            ).catch(err => console.error("DB update error:", err));

            // بث الموقع للعميل
            io.to(orderId).emit("location-updated", { lat, lng, driverId, timestamp: Date.now() });
        });

        // ============================
        // 4. Driver Stops Tracking (Order Delivered)
        socket.on("order-delivered", async ({ orderId, driverId }) => {
            if (!orderId) {
                console.warn(`Attempted order-delivered without orderId from Driver ${driverId}`);
                return;
            }

            try {
                // تحديث حالة الطلب وحذف الموقع
                const updatedOrder = await Order.findOneAndUpdate(
                    { order_number: orderId },
                    { 
                        status: "Delivered",
                        tracked_location: null,
                        deliveredAt: new Date(),
                    },
                    { new: true }
                );

                if (updatedOrder) {
                    console.log(`📦✅ Order ${orderId} delivered by Driver ${driverId}. Notifying customer room.`);

                    // تحديث availability للسائق بعد التسليم
                    if (updatedOrder.assigned_staff_id) {
                        await User.findByIdAndUpdate(updatedOrder.assigned_staff_id, { availability: true });
                    }

                    io.to(orderId).emit("delivery-complete"); 
                } else {
                    console.warn(`Order ${orderId} not found for delivery status update.`);
                }
            } catch (error) {
                console.error(`Error processing order-delivered for ${orderId}:`, error);
            }
        });

        // ============================
        // 5. Disconnect Handler
        socket.on("disconnect", () => {
            console.log(`🔴 Socket disconnected: ${socket.id}`);

            const driverId = socket.data.driverId;
            if (driverId && activeDrivers.get(driverId) === socket.id) {
                activeDrivers.delete(driverId);
                console.log(`🚗❌ Driver offline: ${driverId}`);
            }
        });
    });
};

// لإحضار خريطة السائقين النشطين
export const getActiveDriversMap = () => activeDrivers;

// ============================
// 6. اختيار السائق الأقرب تلقائيًا (يمكن استدعاؤه من submitOrder)
export const assignClosestDriver = async (orderCoords) => {
    try {
        // 1. إحضار جميع السائقين المتاحين
        const availableDrivers = await User.find({
            role: "staff",
            availability: true,
            coords: { $exists: true }
        });

        if (!availableDrivers.length) return null;

        // 2. حساب أقرب سائق (Euclidean distance)
        let closestDriver = null;
        let minDistance = Infinity;

        availableDrivers.forEach(driver => {
            const dx = driver.coords.lat - orderCoords.lat;
            const dy = driver.coords.lng - orderCoords.lng;
            const distance = Math.sqrt(dx*dx + dy*dy);
            if (distance < minDistance) {
                minDistance = distance;
                closestDriver = driver;
            }
        });

        if (closestDriver) {
            // تحديث توافر السائق إلى false
            await User.findByIdAndUpdate(closestDriver._id, { availability: false });
        }

        return closestDriver;

    } catch (err) {
        console.error("Error assigning closest driver:", err);
        return null;
    }
};



// import Order from "../models/Order.js";

// // استخدام Map لتخزين السائقين النشطين (DriverId -> SocketId)
// const activeDrivers = new Map();

// // الثابت الخاص بالغرفة يجب أن يكون متطابقًا مع orderController.js
// const DRIVERS_POOL_ROOM = "drivers-pool"; 

// export const initializeSocketListeners = (io) => {

//     io.on("connection", (socket) => {

//         // 1. Driver Joins (Registers in the map and joins the room)
//         socket.on("driver-join", (driverId) => {
//             if (driverId) {
//                 // الانضمام إلى الغرفة ليتم استقبال البث من submitOrder
//                 socket.join(DRIVERS_POOL_ROOM); 
//                 activeDrivers.set(driverId, socket.id);
//                 // تعيين DriverId على Socket object ليسهل إزالته لاحقًا عند الانفصال
//                 socket.data.driverId = driverId; 

//                 console.log(`🚗 Driver joined: ${driverId} → socket ${socket.id} (Pool: ${DRIVERS_POOL_ROOM})`);
//             }
//         });

//         // ============================
//         // 2. Customer Joins Order Room
//         socket.on("join-order", async (orderId) => {
//             if (!orderId) return;

//             // الانضمام إلى غرفة باسم رقم الطلب
//             socket.join(orderId);
//             console.log(`📦 Customer joined order room: ${orderId}`);

//             // إرسال آخر موقع معروف فورًا
//             try {
//                 const order = await Order.findOne({ order_number: orderId });
//                 if (order?.tracked_location) {
//                     socket.emit("location-updated", {
//                         lat: order.tracked_location.lat,
//                         lng: order.tracked_location.lng,
//                     });
//                 }
//             } catch (error) {
//                 console.error("Error fetching order on join:", error);
//             }
//         });

//         // ============================
//         // 3. Driver Live Location Update
//         // ملاحظة: يمكن استخدام هذا الحدث أو استخدام مسار HTTP POST /driver/location/update
//         // وكلاهما يحقق الغرض.
//         socket.on("update-location", async ({ orderId, driverId, lat, lng }) => {

//             // تحقق صارم من البيانات
//             if (!orderId || typeof lat !== 'number' || typeof lng !== 'number') {
//                 console.warn(`Invalid location data from Driver ${driverId}`);
//                 return;
//             }

//             // Update location in DB (بدون انتظار الـ Promise)
//             Order.findOneAndUpdate(
//                 { order_number: orderId },
//                 { tracked_location: { lat, lng, time: Date.now() } }
//             ).catch(err => console.error("DB update error:", err));

//             // Emit to customers in order room
//             io.to(orderId).emit("location-updated", { lat, lng, driverId, timestamp: Date.now() });
//         });

//         // ============================
//         // 🆕 4. Driver Stops Tracking (Order Delivered)
//         socket.on("order-delivered", async ({ orderId, driverId }) => {
//             if (!orderId) {
//                 console.warn(`Attempted order-delivered without orderId from Driver ${driverId}`);
//                 return;
//             }

//             try {
//                 // 1. تحديث حالة الطلب إلى "Delivered" في قاعدة البيانات وحذف الموقع المتعقب
//                 const updatedOrder = await Order.findOneAndUpdate(
//                     { order_number: orderId },
//                     { 
//                         status: "Delivered", // 🚨 تحديث حالة الطلب
//                         tracked_location: null, // 🚨 حذف آخر موقع للسائق
//                         deliveredAt: new Date(), // تسجيل وقت التسليم
//                     },
//                     { new: true } // للحصول على الوثيقة المحدثة
//                 );

//                 if (updatedOrder) {
//                     console.log(`📦✅ Order ${orderId} delivered by Driver ${driverId}. Notifying customer room.`);
                    
//                     // 2. بث الحدث للعميل في غرفة الطلب
//                     // هذا الحدث (delivery-complete) هو ما يستمع إليه CustomerTracking.jsx
//                     io.to(orderId).emit("delivery-complete"); 
//                 } else {
//                     console.warn(`Order ${orderId} not found for delivery status update.`);
//                 }
//             } catch (error) {
//                 console.error(`Error processing order-delivered for ${orderId}:`, error);
//             }
//         });

//         // ============================
//         // 5. Disconnect Handler
//         socket.on("disconnect", () => {
//             console.log(`🔴 Socket disconnected: ${socket.id}`);

//             // استخدام socket.data.driverId لتحديد السائق المغادر
//             const driverId = socket.data.driverId;
//             // التحقق للتأكد من أن السائق كان مسجلًا لدينا ومنع إزالة خاطئة
//             if (driverId && activeDrivers.get(driverId) === socket.id) {

//                 activeDrivers.delete(driverId);
//                 console.log(`🚗❌ Driver offline: ${driverId}`);
//             }
//         });
//     });
// };

// export const getActiveDriversMap = () => activeDrivers;


