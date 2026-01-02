import { Router } from "express";
import {
  // createUser,
  getUsers,
  getUser,
  updateUser,
  staffUpdateAvailability,
  deleteUser,
  register,
  login,
  adminResetStaffPassword
} from "../controllers/userController.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// Public (for staff/admin login only)
router.post("/register",authMiddleware(["admin"]), register); 
router.post("/login", login);

// Protected (admin only)
// router.post("/", authMiddleware(["admin"]), createUser);
router.get("/", getUsers);
router.get("/:id", getUser);
router.put("/:id", authMiddleware(["admin"]), updateUser);
router.put("/:id/availability", authMiddleware(["staff"]), staffUpdateAvailability);
router.delete("/:id", authMiddleware(["admin"]), deleteUser);
router.patch("/reset-password/:userId", authMiddleware(["admin"]), adminResetStaffPassword);

export default router;
