import Plan from "../model/plan.model.js";
import Razorpay from "razorpay";
import crypto from "crypto";

const getRazorpay = () => new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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

// Create Purchase Order for a Plan (Lab)
export const createPlanPurchaseOrder = async (req, res) => {
    try {
        const { planId } = req.body;
        const labId = req.user.id;
        
        if (!planId) {
            return res.status(400).json({ success: false, message: "planId is required" });
        }

        const plan = await Plan.findById(planId);
        if (!plan) {
            return res.status(404).json({ success: false, message: "Plan not found" });
        }

        const timestamp = Date.now().toString().slice(-8);
        const labIdShort = labId.toString().slice(-8);
        const receipt = `plan_${labIdShort}_${timestamp}`;

        const order = await getRazorpay().orders.create({
            amount: plan.price * 100, // Amount in paise
            currency: "INR",
            receipt: receipt,
            notes: { labId: labId.toString(), planId: planId.toString() },
        });

        res.status(200).json({
            success: true,
            message: "Order created successfully",
            data: {
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                keyId: process.env.RAZORPAY_KEY_ID,
                plan: { name: plan.name, price: plan.price },
            },
        });
    } catch (error) {
        const errorMsg = error?.error?.description || error?.message || "Failed to create order";
        res.status(500).json({ success: false, message: errorMsg });
    }
};

// Verify Payment and Activate Plan (Lab)
export const verifyPlanPurchase = async (req, res) => {
    try {
        const labId = req.user.id;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planId) {
            return res.status(400).json({ success: false, message: "Missing payment details or planId" });
        }

        // Verify signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: "Payment verification failed. Invalid signature." });
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

        // Calculate expiry date based on plan duration (in days)
        const now = new Date();
        const expiryDate = new Date(now);
        expiryDate.setDate(expiryDate.getDate() + plan.duration);

        // Add purchased plan to lab's history
        lab.purchasedPlans.push({
            planId: plan._id,
            purchaseDate: now,
            expiryDate: expiryDate,
            status: "active"
        });

        // Set subscription expiry on the lab record
        lab.subscriptionExpiry = expiryDate;

        await lab.save();

        res.status(200).json({
            success: true,
            message: `Payment verified! ${plan.name} plan activated successfully. Valid until ${expiryDate.toDateString()}.`,
            data: {
                plan: plan.name,
                duration: plan.duration,
                expiryDate: expiryDate,
                isActive: true
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
        let globalFreeLimit = 10;
        try {
            const Setting = (await import("../model/settings.model.js")).default;
            const defaultSetting = await Setting.findOne({ key: "defaultFreeBookings" });
            if (defaultSetting) {
                globalFreeLimit = Number(defaultSetting.value);
            }
        } catch (err) {
            console.error("FAILED_TO_FETCH_SETTINGS_IN_STATS:", err);
        }

        const now = new Date();
        const hasActivePlan = lab.subscriptionExpiry && new Date(lab.subscriptionExpiry) > now;
        
        res.status(200).json({
            success: true,
            data: {
                hasActivePlan: hasActivePlan,
                subscriptionExpiry: lab.subscriptionExpiry,
                freeBookingsUsed: lab.usedBookings || 0,
                freeBookingsLimit: globalFreeLimit,
                remainingFreeBookings: hasActivePlan ? null : Math.max(0, globalFreeLimit - (lab.usedBookings || 0)),
                purchasedPlans: lab.purchasedPlans
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
