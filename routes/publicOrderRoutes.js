// src/routes/publicOrderRoutes.js
import { Router } from "express";
import { submitOrder, trackOrder } from "../controllers/publicOrderController.js";

const router = Router();

// Customer submits a delivery request (NO LOGIN)
router.post("/submit", submitOrder);

// Customer tracks their order (NO LOGIN)
router.get("/track/:order_number", trackOrder);

export default router;
