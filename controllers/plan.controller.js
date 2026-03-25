import Plan from "../model/plan.model.js";

// Create a new plan (Admin)
export const createPlan = async (req, res) => {
    try {
        const plan = new Plan(req.body);
        await plan.save();
        res.status(201).json({ success: true, message: "Subscription Plan created successfully", data: plan });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all plans (Public)
export const getPlans = async (req, res) => {
    try {
        const { status } = req.query;
        const query = status ? { status: status === 'true' } : {};
        const plans = await Plan.find(query).sort({ displayOrder: 1, createdAt: -1 });
        res.status(200).json({ success: true, data: plans });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update a plan (Admin)
export const updatePlan = async (req, res) => {
    try {
        const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });
        res.status(200).json({ success: true, message: "Subscription Plan updated successfully", data: plan });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete a plan (Admin)
export const deletePlan = async (req, res) => {
    try {
        const plan = await Plan.findByIdAndDelete(req.params.id);
        if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });
        res.status(200).json({ success: true, message: "Subscription Plan deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
