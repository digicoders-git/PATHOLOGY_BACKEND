import Support from "../../model/support.model.js";

/**
 * Submit a new support query
 */
export const submitSupportQuery = async (req, res) => {
  try {
    const { subject, message } = req.body;
    const patientId = req.user.id;

    if (!subject || !message) {
      return res.status(400).json({ success: false, message: "Subject and message are required" });
    }

    const newSupport = new Support({
      patientId,
      subject,
      message,
    });

    await newSupport.save();

    res.status(201).json({
      success: true,
      message: "Your query has been submitted successfully. Our support team will contact you soon.",
      data: newSupport,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get all support queries for a specific patient
 */
export const getMySupportQueries = async (req, res) => {
  try {
    const patientId = req.user.id;
    
    const queries = await Support.find({ patientId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: queries.length,
      data: queries,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
