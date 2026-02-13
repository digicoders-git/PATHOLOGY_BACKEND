import Parent from "../model/parent.model.js";
import Registration from "../model/registration.model.js";

// Create Parent
export const createParent = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }
    const newParent = new Parent({ name });
    await newParent.save();
    res.status(201).json({ success: true, message: "Parent created successfully", data: newParent });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get All Parents (with filtering and pagination)
export const getAllParents = async (req, res) => {
  try {
    const { search = "", status, page = 1, limit = 50 } = req.query;

    const query = {};
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }
    if (status !== undefined && status !== "") {
      query.status = status === "true" || status === true;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Use aggregation to count registrations for each parent
    const [total, parents] = await Promise.all([
      Parent.countDocuments(query),
      Parent.aggregate([
        { $match: query },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) },
        {
          $lookup: {
            from: "registrations",
            localField: "_id",
            foreignField: "parent",
            as: "labs"
          }
        },
        {
          $addFields: {
            registrationCount: { $size: "$labs" }
          }
        },
        {
          $project: {
            labs: 0
          }
        }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: parents,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Parent
export const updateParent = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const updatedParent = await Parent.findByIdAndUpdate(id, { name }, { new: true });
    if (!updatedParent) {
      return res.status(404).json({ success: false, message: "Parent not found" });
    }
    res.status(200).json({ success: true, message: "Parent updated successfully", data: updatedParent });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Parent
export const deleteParent = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedParent = await Parent.findByIdAndDelete(id);
    if (!deletedParent) {
      return res.status(404).json({ success: false, message: "Parent not found" });
    }
    res.status(200).json({ success: true, message: "Parent deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Toggle Status
export const updateParentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updatedParent = await Parent.findByIdAndUpdate(id, { status }, { new: true });
    if (!updatedParent) {
      return res.status(404).json({ success: false, message: "Parent not found" });
    }
    res.status(200).json({ success: true, message: "Status updated successfully", data: updatedParent });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
