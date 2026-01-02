import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";


// ===========================
// ADMIN / STAFF REGISTER
// ===========================

export const register = async (req, res) => {
  try {
    const { full_name, username, phone, address, password, role } = req.body;

    if (!full_name || !username || !phone || !password || !role) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (!["admin", "staff"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    // منع إنشاء admin من الواجهة
    if (role === "admin") {
      return res.status(403).json({ error: "Admins can only be created by another admin" });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      full_name,
      username,
      phone,
      address,
      password: hashedPassword,
      role,
    });

    res.status(201).json({
      message: "User created successfully",
      user: {
        _id: user._id,
        full_name: user.full_name,
        username: user.username,
        phone: user.phone,
        address: user.address,
        role: user.role,
        availability: user.availability,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
};




// ===========================
// LOGIN
// ===========================


export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username }).select("+password");
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
};




// ===========================
// CRUD OPERATIONS
// ===========================
// export const createUser = async (req, res) => {
//   try {
//     const { role, password, ...rest } = req.body;

//     if (!["admin", "staff"].includes(role)) {
//       return res.status(400).json({ error: "Invalid role" });
//     }

//     // Only admin can create new users
//     if (req.user.role !== "admin") {
//       return res.status(403).json({ error: "Only admins can create users" });
//     }

//     const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

//     const user = await User.create({
//       ...rest,
//       role,
//       password: hashedPassword
//     });

//     res.status(201).json({
//       _id: user._id,
//       full_name: user.full_name,
//       username: user.username,
//       role: user.role,
//     });

//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };



// Get All Users
export const getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};



// Get Single User
export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};



export const staffUpdateAvailability = async (req, res) => {
  try {
    const userId = req.user.id.toString();

    if (userId !== req.params.id) {
      return res.status(403).json({ error: "You cannot modify another staff member" });
    }

    const { availability } = req.body;
    if (availability === undefined) {
      return res.status(400).json({ error: "Availability value is required" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { availability },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


export const updateUser = async (req, res) => {
  try {
    const updateData = { ...req.body };

    // Hash new password if provided
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    // Prevent changing role to admin unless requester is admin
    if (updateData.role === "admin" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can assign admin role" });
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).select("-password");

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};



// Delete User

export const deleteUser = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent deleting admins
    if (targetUser.role === "admin") {
      return res.status(403).json({ error: "Admins cannot delete other admins" });
    }

    // Only admins can delete users
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can delete users" });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ message: "User deleted successfully" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};



// ===========================
// ADMIN RESET STAFF PASSWORD
// ===========================
export const adminResetStaffPassword = async (req, res) => {
    try {
        const { userId } = req.params;
        const { newPassword } = req.body;

        // 1. Authorization: Only Admin can reset passwords
        if (req.user.role !== "admin") {
            return res.status(403).json({ error: "Only admins can reset user passwords." });
        }

        // 2. Validation
        if (!newPassword || newPassword.length < 6) { // Add your desired length requirement
            return res.status(400).json({ error: "New password must be at least 6 characters long." });
        }

        // 3. Hash the new password
        const salt = Number(process.env.SALT_ROUNDS) || 10;
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // 4. Update the user's password in the database
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        // Optional: Prevent admin from resetting *another* admin's password (for safety)
        if (user.role === "admin" && user._id.toString() !== req.user.id.toString()) {
             // You can choose to allow or deny this. Here we deny it for security.
             return res.status(403).json({ error: "Admin cannot reset another admin's password." });
        }

        user.password = hashedPassword;
        await user.save(); // Mongoose save hook can re-hash if you set up a pre-save hook, but for simplicity, we do it explicitly here.

        res.json({ message: `Password for user ${user.username} reset successfully by admin.` });

    } catch (err) {
        console.error("ADMIN RESET PASSWORD ERROR:", err);
        res.status(500).json({ error: "Server error during password reset" });
    }
};
