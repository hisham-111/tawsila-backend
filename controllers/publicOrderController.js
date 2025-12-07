import Order from "../models/Order.js";



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


export const submitOrder = async (req, res) => {
    try { 
        const orderData = {
            ...req.body,
            order_number: generateOrderNumber(), // استخدام الدالة المخصصة
        };

        const newOrder = await Order.create(orderData);

        // 2. Notify ALL active drivers via Socket.IO (Broadcast to the pool)
        const io = req.app.get("io");
        
        if (io) {
            // الآن DRIVERS_POOL_ROOM مُعرّف ولن يسبب خطأ
            io.to(DRIVERS_POOL_ROOM).emit("new-order", {
                order_number: newOrder.order_number,
                type_of_item: newOrder.type_of_item,
                customer_address: newOrder.customer.address,
                customer_coords: newOrder.customer.coords,
            });

            console.log(`✅ Sent new order ${newOrder.order_number} to all active drivers in the pool.`);
        } else {
            console.log(`⚠️ Socket.IO not initialized. Order ${newOrder.order_number} submitted but not broadcasted.`);
        }

        // 3. Return success response
        res.status(201).json({
            message: "Order submitted successfully",
            order: { order_number: newOrder.order_number },
        });

    } catch (error) {
        console.error("❌ CRITICAL SUBMISSION ERROR:", error);

        // 💡 منطق محسّن للتعامل مع أخطاء التحقق من صحة البيانات
        if (error.name === "ValidationError") {
            // إرجاع 400 (Bad Request) لأخطاء البيانات المدخلة
            return res.status(400).json({ error: "Validation Failed", details: error.message });
        }
        
        // إرجاع 500 لأخطاء الخادم الأخرى
        res.status(500).json({ error: "Failed to process order submission due to a server error.", details: error.message });
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

