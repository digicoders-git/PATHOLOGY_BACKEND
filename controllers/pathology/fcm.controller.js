import Registration from "../../model/registration.model.js";

// Save FCM Token
export const savePathologyFCMToken = async (req, res) => {
  try {
    const { token } = req.body;
    const pathologyId = req.user.id;

    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }

    const pathology = await Registration.findByIdAndUpdate(
      pathologyId,
      { $addToSet: { fcmTokens: token } },
      { new: true }
    );

    if (!pathology) {
      return res.status(404).json({ success: false, message: "Pathology not found" });
    }

    res.status(200).json({ success: true, message: "FCM token saved successfully" });
  } catch (error) {
    console.error("SAVE_PATHOLOGY_FCM_ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to save FCM token" });
  }
};

// Remove FCM Token (On Logout)
export const removePathologyFCMToken = async (req, res) => {
  try {
    const { token } = req.body;
    const pathologyId = req.user.id;

    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }

    const pathology = await Registration.findByIdAndUpdate(
      pathologyId,
      { $pull: { fcmTokens: token } },
      { new: true }
    );

    if (!pathology) {
      return res.status(404).json({ success: false, message: "Pathology not found" });
    }

    res.status(200).json({ success: true, message: "FCM token removed successfully" });
  } catch (error) {
    console.error("REMOVE_PATHOLOGY_FCM_ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to remove FCM token" });
  }
};
