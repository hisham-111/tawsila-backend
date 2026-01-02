import { Router } from "express";
import {
  getOrders,
  getOrder,
  getPlacesStats,
  getOrdersByRange,
  updateOrder,
  deleteOrder,
  getAvailableOrders,
  acceptOrder,
  updateDriverLocation,
  calculateRouteInfo,
  submitOrderRating,
  cancelOrder
} from "../controllers/orderController.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.patch("/:orderId/rate", submitOrderRating); 
router.get('/orders/available', getAvailableOrders);
router.get("/places", authMiddleware(["admin"]), getPlacesStats);
router.get("/logs-status", authMiddleware(["admin"]), getOrdersByRange);
router.get("/", getOrders); 
router.post('/route-info', calculateRouteInfo);
router.post("/accept", authMiddleware(["staff"]), acceptOrder);
router.post("/cancel/:orderId", authMiddleware(["staff"]), cancelOrder);
router.post('/location/update', updateDriverLocation);
router.get("/:id", getOrder); 
router.put("/:id", authMiddleware(["staff", "admin"]), updateOrder);
router.delete("/:id", authMiddleware(["admin"]), deleteOrder);

export default router;
