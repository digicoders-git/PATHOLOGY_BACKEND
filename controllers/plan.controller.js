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

// Purchase a plan (Lab)
export const purchasePlan = async (req, res) => {
    try {
        const { planId, labId } = req.body;
        
        if (!planId || !labId) {
            return res.status(400).json({ success: false, message: "planId and labId are required" });
        }

        const plan = await Plan.findById(planId);
        if (!plan) {
            return res.status(404).json({ success: false, message: "Plan not found" });
        }

        const Registration = (await import("../model/registration.model.js")).default;
        const lab = await Registration.findById(labId);
        if (!lab) {
            return res.status(404).json({ success: false, message: "Lab not found" });
        }

        // Calculate expiry date
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + plan.duration);

        // Add purchased plan to lab's history
        lab.purchasedPlans.push({
            planId: plan._id,
            purchaseDate: new Date(),
            expiryDate: expiryDate,
            bookingsGranted: plan.freeBookings,
            status: "active"
        });

        // Add bookings to lab's total
        lab.totalBookings += plan.freeBookings;
        lab.subscriptionExpiry = expiryDate;

        await lab.save();

        res.status(200).json({
            success: true,
            message: `Plan purchased successfully! ${plan.freeBookings} bookings added.`,
            data: {
                plan: plan.name,
                bookingsAdded: plan.freeBookings,
                totalBookings: lab.totalBookings,
                usedBookings: lab.usedBookings,
                remainingBookings: lab.totalBookings - lab.usedBookings,
                expiryDate: expiryDate
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get lab's booking stats (Lab)
export const getLabBookingStats = async (req, res) => {
    try {
        const labId = req.user.id;
        
        const Registration = (await import("../model/registration.model.js")).default;
        const lab = await Registration.findById(labId).populate('purchasedPlans.planId');
        
        if (!lab) {
            return res.status(404).json({ success: false, message: "Lab not found" });
        }

        // Get global default free bookings limit dynamically
        let globalLimit = 10;
        try {
            const Setting = (await import("../model/settings.model.js")).default;
            const defaultSetting = await Setting.findOne({ key: "defaultFreeBookings" });
            if (defaultSetting) {
                globalLimit = Number(defaultSetting.value);
            }
        } catch (err) {
            console.error("FAILED_TO_FETCH_SETTINGS_IN_STATS:", err);
        }

        const hasPurchasedPlans = lab.purchasedPlans && lab.purchasedPlans.length > 0;
        const effectiveLimit = hasPurchasedPlans ? (lab.totalBookings - 5 + globalLimit) : globalLimit;
        const remainingBookings = effectiveLimit - lab.usedBookings;
        
        res.status(200).json({
            success: true,
            data: {
                totalBookings: effectiveLimit,
                usedBookings: lab.usedBookings,
                remainingBookings: remainingBookings,
                freeBookings: globalLimit,
                subscriptionExpiry: lab.subscriptionExpiry,
                purchasedPlans: lab.purchasedPlans
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
