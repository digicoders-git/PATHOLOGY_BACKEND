import jwt from "jsonwebtoken";
import Registration from "../model/registration.model.js";

export const pathologyAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "No token provided. Please login as Pathology." });
    }

    const token = authHeader.split(" ")[1];

    // Note: We need to use the exact same secret as generateToken
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.id) {
      return res.status(401).json({ success: false, message: "Invalid token structure" });
    }

    // Verify if this ID actually exists in Registration collection
    const pathology = await Registration.findById(decoded.id);

    if (!pathology) {
      return res.status(401).json({ success: false, message: "Unauthorized: Pathology account not found" });
    }

    // Check if account is active
    if (!pathology.status) {
      return res.status(403).json({ success: false, message: "Your account is inactive. Please contact admin." });
    }

    // Attach pathology info to request
    req.user = {
      id: pathology._id,
      labName: pathology.labName,
      email: pathology.email
    };

    next();
  } catch (error) {
    console.error("PATHOLOGY_AUTH_ERROR:", error.message);
    return res.status(401).json({ success: false, message: "Session expired or invalid token. Please login again." });
  }
};
