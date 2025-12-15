import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import { initializeSocketListeners } from "./socket/socketHandler.js"; 
import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import publicOrderRoutes from "./routes/publicOrderRoutes.js";

dotenv.config();

// =======================================
// CRITICAL CORS CONFIGURATION FIX
// This section allows multiple frontend origins (local and deployed)
// =======================================

// 1. Define the list of allowed origins (frontend URLs)
const allowedOrigins = [
    "http://localhost:5173" , "https://tawsiladelivery.netlify.app" // Development environment
    // IMPORTANT: Add your deployed frontend URL here, e.g., "https://your-website.com"
];

// 2. Conditionally add the CLIENT_URL from environment variables if it exists
if (process.env.CLIENT_URL) {
    if (!allowedOrigins.includes(process.env.CLIENT_URL)) {
        allowedOrigins.push(process.env.CLIENT_URL);
    }
}

// =======================================
// EXPRESS INIT
// =======================================
const app = express();

// Middleware: Configure CORS with the list of allowed origins
app.use(
    cors({
        // Set the origin to the robust list
        origin: allowedOrigins,
        credentials: true,
        optionsSuccessStatus: 200, 
    })
);

app.use(express.json());

// =======================================
// ROUTES
// =======================================
app.use("/api/users", userRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/public/order", publicOrderRoutes);

// =======================================
// SOCKET.IO SERVER
// =======================================
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        // Use the same robust list for Socket.IO
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true,
    },
        transports: ["websocket", "polling"], // 🔥 مهم للهاتف
});

// ⚡️ Expose io to controllers
app.set("io", io);

initializeSocketListeners(io); 


// =======================================
// START SERVER + MONGO
// =======================================

const startServer = async () => {
    try {
        // 🔥 1. Call your imported function to connect to the DB
        await connectDB();
        
        // 🔥 2. Remove the old connection code: await mongoose.connect(process.env.MONGO_URI);
        //    (The error handling for Mongo connection is now inside connectDB)

        const PORT = process.env.PORT || 5000;
        httpServer.listen(PORT, () =>
            console.log(` Server + Socket.IO running on port ${PORT}`)
        );
    } catch (error) {
        // This catch block will now mostly handle Express/Socket server startup errors, 
        // as the MongoDB connection error handles its own exit.
        console.error("❌ Server Startup Error:", error.message);
       
        process.exit(1);
    }
};

startServer();
// const startServer = async () => {
//     try {
//         await mongoose.connect(process.env.MONGO_URI);
//         console.log("✅ MongoDB Connected Successfully");

//         const PORT = process.env.PORT || 5000;
//         httpServer.listen(PORT, () =>
//             console.log(` Server + Socket.IO running on port ${PORT}`)
//         );
//     } catch (error) {
//         console.error("❌ MongoDB Error:", error.message);
//         process.exit(1);
//     }
// };

// startServer();

