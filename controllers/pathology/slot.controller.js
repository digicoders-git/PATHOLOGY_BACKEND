import LabSlot from "../../model/labSlot.model.js";

/**
 * Generate default slots for a lab for a specific date range or single date
 * Typically used by Lab Admin
 */
export const generateSlots = async (req, res) => {
  try {
    const { labId, date, slots } = req.body; // slots: [{startTime, endTime}, ...]

    if (!labId || !date || !slots || !slots.length) {
      return res.status(400).json({ success: false, message: "labId, date and slots are required" });
    }

    const createdSlots = await Promise.all(
      slots.map(async (s) => {
        // Check if slot already exists to avoid duplicates
        const existing = await LabSlot.findOne({ labId, date, startTime: s.startTime });
        if (existing) return existing;

        return await LabSlot.create({
          labId,
          date,
          startTime: s.startTime,
          endTime: s.endTime,
        });
      })
    );

    res.json({
      success: true,
      message: `${createdSlots.length} slots processed for ${date}`,
      data: createdSlots,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get all slots for a lab (Admin view)
 */
export const getLabSlots = async (req, res) => {
  try {
    const { labId, date } = req.query;
    const query = { labId };
    if (date) query.date = date;

    const slots = await LabSlot.find(query).sort({ date: 1, startTime: 1 });
    res.json({ success: true, data: slots });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete a slot
 */
export const deleteSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const slot = await LabSlot.findById(id);
    if (!slot) return res.status(404).json({ success: false, message: "Slot not found" });

    if (slot.isBooked) {
      return res.status(400).json({ success: false, message: "Cannot delete a booked slot" });
    }

    await LabSlot.findByIdAndDelete(id);
    res.json({ success: true, message: "Slot deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
