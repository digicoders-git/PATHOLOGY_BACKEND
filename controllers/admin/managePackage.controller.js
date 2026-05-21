import Package from "../../model/admin/managePackage.model.js";
import LabSubscription from "../../model/labSubscription.model.js";
import Razorpay from "razorpay";
import crypto from "crypto";

// Lazy init — env variables load hone ke baad
const getRazorpay = () => new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── Helper: reset period counters if needed ───────────────────────────────────
const resetPeriodCounters = async (sub) => {
  const now = new Date();
  let changed = false;

  // Weekly reset
  if (!sub.weekResetAt || now - sub.weekResetAt >= 7 * 24 * 60 * 60 * 1000) {
    sub.bookingsThisWeek = 0;
    sub.weekResetAt = now;
    changed = true;
  }
  // Monthly reset
  if (!sub.monthResetAt || now.getMonth() !== sub.monthResetAt.getMonth() || now.getFullYear() !== sub.monthResetAt.getFullYear()) {
    sub.bookingsThisMonth = 0;
    sub.monthResetAt = now;
    changed = true;
  }
  // Yearly reset
  if (!sub.yearResetAt || now.getFullYear() !== sub.yearResetAt.getFullYear()) {
    sub.bookingsThisYear = 0;
    sub.yearResetAt = now;
    changed = true;
  }

  // Check plan expiry
  if (sub.subscriptionStatus === "active" && sub.planEndDate && now > sub.planEndDate) {
    sub.subscriptionStatus = "expired";
    changed = true;
  }

  if (changed) await sub.save();
  return sub;
};

// ── Helper: get or create subscription for a lab ─────────────────────────────
const getOrCreateSub = async (labId) => {
  let sub = await LabSubscription.findOne({ labId });
  if (!sub) sub = await LabSubscription.create({ labId });
  return sub;
};

// ═══════════════════ ADMIN — PACKAGE CRUD ════════════════════════════════════

// CREATE PACKAGE
export const createPackage = async (req, res) => {
  try {
    const {
      packageName, description, price, durationDays, durationType,
      freeBookingsLimit, weeklyBookingLimit, monthlyBookingLimit,
      yearlyBookingLimit, benefits, isPopular, badgeText, displayOrder,
    } = req.body;

    if (!packageName || !price || !durationDays) {
      return res.status(400).json({ success: false, message: "packageName, price and durationDays are required" });
    }

    const pkg = await Package.create({
      packageName,
      description: description || "",
      price: Number(price),
      durationDays: Number(durationDays),
      durationType: durationType || "monthly",
      freeBookingsLimit: Number(freeBookingsLimit) || 0,
      weeklyBookingLimit: Number(weeklyBookingLimit) || 0,
      monthlyBookingLimit: Number(monthlyBookingLimit) || 0,
      yearlyBookingLimit: Number(yearlyBookingLimit) || 0,
      benefits: typeof benefits === "string" ? JSON.parse(benefits) : (benefits || []),
      isPopular: isPopular === "true" || isPopular === true,
      badgeText: badgeText || "",
      displayOrder: Number(displayOrder) || 0,
    });

    res.status(201).json({ success: true, message: "Package created successfully", data: pkg });
  } catch (err) {
    console.error("CREATE_PACKAGE_ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET ALL PACKAGES
export const getAllPackages = async (req, res) => {
  try {
    const { search, status } = req.query;
    const query = { isDeleted: false };
    if (search) query.packageName = { $regex: search, $options: "i" };
    if (status !== undefined && status !== "") query.status = status === "true";

    const packages = await Package.find(query).sort({ displayOrder: 1, createdAt: -1 });
    res.status(200).json({ success: true, count: packages.length, data: packages });
  } catch (err) {
    console.error("GET_ALL_PACKAGES_ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET SINGLE PACKAGE
export const getSinglePackage = async (req, res) => {
  try {
    const pkg = await Package.findOne({ _id: req.params.id, isDeleted: false });
    if (!pkg) return res.status(404).json({ success: false, message: "Package not found" });
    res.status(200).json({ success: true, data: pkg });
  } catch (err) {
    console.error("GET_SINGLE_PACKAGE_ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPDATE PACKAGE
export const updatePackage = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.benefits && typeof updateData.benefits === "string") {
      updateData.benefits = JSON.parse(updateData.benefits);
    }
    ["price", "durationDays", "freeBookingsLimit", "weeklyBookingLimit", "monthlyBookingLimit", "yearlyBookingLimit", "displayOrder"].forEach(f => {
      if (updateData[f] !== undefined) updateData[f] = Number(updateData[f]);
    });
    if (updateData.isPopular !== undefined) updateData.isPopular = updateData.isPopular === "true" || updateData.isPopular === true;

    const pkg = await Package.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!pkg) return res.status(404).json({ success: false, message: "Package not found" });
    res.status(200).json({ success: true, message: "Package updated successfully", data: pkg });
  } catch (err) {
    console.error("UPDATE_PACKAGE_ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE PACKAGE (soft)
export const deletePackage = async (req, res) => {
  try {
    const pkg = await Package.findByIdAndUpdate(req.params.id, { isDeleted: true }, { new: true });
    if (!pkg) return res.status(404).json({ success: false, message: "Package not found" });
    res.status(200).json({ success: true, message: "Package deleted successfully" });
  } catch (err) {
    console.error("DELETE_PACKAGE_ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// TOGGLE STATUS
export const togglePackageStatus = async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ success: false, message: "Package not found" });
    pkg.status = !pkg.status;
    await pkg.save();
    res.status(200).json({ success: true, message: "Status updated", data: pkg });
  } catch (err) {
    console.error("TOGGLE_PACKAGE_STATUS_ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════ ADMIN — SET FREE BOOKINGS FOR A LAB ═════════════════════

export const setFreeBookingsForLab = async (req, res) => {
  try {
    const { labId, freeBookingsLimit } = req.body;
    if (!labId || freeBookingsLimit === undefined) {
      return res.status(400).json({ success: false, message: "labId and freeBookingsLimit required" });
    }

    const sub = await getOrCreateSub(labId);
    sub.freeBookingsLimit = Number(freeBookingsLimit);
    await sub.save();

    res.status(200).json({ success: true, message: "Free bookings limit set", data: sub });
  } catch (err) {
    console.error("SET_FREE_BOOKINGS_ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════ LAB — GET MY SUBSCRIPTION ═══════════════════════════════

export const getMySubscription = async (req, res) => {
  try {
    const labId = req.user.id;
    let sub = await getOrCreateSub(labId);
    sub = await resetPeriodCounters(sub);
    await sub.populate("packageId");

    let limit = sub.freeBookingsLimit;
    if (!limit || limit === 0) {
      const Setting = (await import("../../model/settings.model.js")).default;
      const setting = await Setting.findOne({ key: "defaultFreeBookings" });
      limit = setting ? Number(setting.value) : 10;
    }

    res.status(200).json({
      success: true,
      data: {
        subscriptionStatus: sub.subscriptionStatus,
        package: sub.packageId,
        freeBookingsLimit: limit,
        freeBookingsUsed: sub.freeBookingsUsed,
        freeBookingsRemaining: Math.max(0, limit - sub.freeBookingsUsed),
        planStartDate: sub.planStartDate,
        planEndDate: sub.planEndDate,
        bookingLimits: {
          weekly: sub.weeklyBookingLimit,
          monthly: sub.monthlyBookingLimit,
          yearly: sub.yearlyBookingLimit,
        },
        bookingsUsed: {
          thisWeek: sub.bookingsThisWeek,
          thisMonth: sub.bookingsThisMonth,
          thisYear: sub.bookingsThisYear,
          total: sub.totalBookingsAccepted,
        },
        canAcceptBooking: await canLabAcceptBooking(labId),
      },
    });
  } catch (err) {
    console.error("GET_MY_SUBSCRIPTION_ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════ LAB — PURCHASE PLAN (Razorpay Order) ════════════════════

export const createPurchaseOrder = async (req, res) => {
  try {
    const labId = req.user.id;
    const { packageId } = req.body;

    if (!packageId) {
      return res.status(400).json({ success: false, message: "packageId is required" });
    }

    const pkg = await Package.findOne({ _id: packageId, isDeleted: false });
    if (!pkg) return res.status(404).json({ success: false, message: "Package not found" });

    // Generate short receipt (max 40 chars)
    const timestamp = Date.now().toString().slice(-8);
    const labIdShort = labId.toString().slice(-8);
    const receipt = `rcpt_${labIdShort}_${timestamp}`;

    const order = await getRazorpay().orders.create({
      amount: pkg.price * 100,
      currency: "INR",
      receipt: receipt,
      notes: { labId: labId.toString(), packageId: packageId.toString() },
    });

    const sub = await getOrCreateSub(labId);
    sub.razorpayOrderId = order.id;
    await sub.save();

    res.status(200).json({
      success: true,
      message: "Order created",
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        package: { name: pkg.packageName, price: pkg.price },
      },
    });
  } catch (err) {
    console.error("CREATE_PURCHASE_ORDER_ERROR:", err);
    const errorMsg = err?.error?.description || err?.message || "Failed to create order";
    res.status(500).json({ success: false, message: errorMsg });
  }
};

// ═══════════════════ LAB — VERIFY PAYMENT & ACTIVATE PLAN ════════════════════

export const verifyPaymentAndActivate = async (req, res) => {
  try {
    const labId = req.user.id;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, packageId } = req.body;

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    const pkg = await Package.findById(packageId);
    if (!pkg) return res.status(404).json({ success: false, message: "Package not found" });

    const now = new Date();
    const endDate = new Date(now.getTime() + pkg.durationDays * 24 * 60 * 60 * 1000);

    const sub = await getOrCreateSub(labId);
    sub.packageId = packageId;
    sub.subscriptionStatus = "active";
    sub.planStartDate = now;
    sub.planEndDate = endDate;
    sub.weeklyBookingLimit = pkg.weeklyBookingLimit;
    sub.monthlyBookingLimit = pkg.monthlyBookingLimit;
    sub.yearlyBookingLimit = pkg.yearlyBookingLimit;
    sub.bookingsThisWeek = 0;
    sub.bookingsThisMonth = 0;
    sub.bookingsThisYear = 0;
    sub.weekResetAt = now;
    sub.monthResetAt = now;
    sub.yearResetAt = now;
    sub.razorpayOrderId = razorpay_order_id;
    sub.razorpayPaymentId = razorpay_payment_id;
    sub.lastPaymentAmount = pkg.price;
    await sub.save();

    res.status(200).json({
      success: true,
      message: "Plan activated successfully",
      data: {
        subscriptionStatus: "active",
        planEndDate: endDate,
        package: pkg.packageName,
      },
    });
  } catch (err) {
    console.error("VERIFY_PAYMENT_ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════ BOOKING ACCEPT / DECLINE ════════════════════════════════

// Helper — check if lab can accept a booking
export const canLabAcceptBooking = async (labId) => {
  let sub = await LabSubscription.findOne({ labId });
  if (!sub) return { allowed: false, reason: "No subscription found" };

  sub = await resetPeriodCounters(sub);

  // Active plan — check limits
  if (sub.subscriptionStatus === "active") {
    if (sub.weeklyBookingLimit > 0 && sub.bookingsThisWeek >= sub.weeklyBookingLimit)
      return { allowed: false, reason: `Weekly limit reached (${sub.weeklyBookingLimit})` };
    if (sub.monthlyBookingLimit > 0 && sub.bookingsThisMonth >= sub.monthlyBookingLimit)
      return { allowed: false, reason: `Monthly limit reached (${sub.monthlyBookingLimit})` };
    if (sub.yearlyBookingLimit > 0 && sub.bookingsThisYear >= sub.yearlyBookingLimit)
      return { allowed: false, reason: `Yearly limit reached (${sub.yearlyBookingLimit})` };
    return { allowed: true, reason: "Active plan" };
  }

  // Free tier — check free bookings
  if (sub.subscriptionStatus === "free") {
    let limit = sub.freeBookingsLimit;
    if (!limit || limit === 0) {
      const Setting = (await import("../../model/settings.model.js")).default;
      const setting = await Setting.findOne({ key: "defaultFreeBookings" });
      limit = setting ? Number(setting.value) : 10;
    }

    if (sub.freeBookingsUsed >= limit) {
      return { allowed: false, reason: `Free booking limit reached (${limit}). Please purchase a plan.` };
    }
    return { allowed: true, reason: "Free tier" };
  }

  // Expired
  return { allowed: false, reason: "Plan expired. Please renew." };
};

// ACCEPT BOOKING
export const acceptBooking = async (req, res) => {
  try {
    const labId = req.user.id;
    const { bookingId, bookingType = "TestBooking" } = req.body;

    if (!bookingId) return res.status(400).json({ success: false, message: "bookingId required" });

    // First check current booking status
    let existingBooking;
    if (bookingType === "TestBooking") {
      const TestBooking = (await import("../../model/testBooking.model.js")).default;
      existingBooking = await TestBooking.findOne({ _id: bookingId, labId });
    } else {
      const Booking = (await import("../../model/booking.model.js")).default;
      existingBooking = await Booking.findOne({ _id: bookingId, registration: labId });
    }

    if (!existingBooking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Check if already confirmed or cancelled
    const currentStatus = existingBooking.bookingStatus || existingBooking.status;
    if (currentStatus === "Confirmed") {
      return res.status(400).json({ success: false, message: "Booking is already confirmed" });
    }
    if (currentStatus === "Cancelled") {
      return res.status(400).json({ success: false, message: "Cannot accept a cancelled booking" });
    }

    // Check if lab can accept
    const check = await canLabAcceptBooking(labId);
    if (!check.allowed) {
      return res.status(403).json({ success: false, message: check.reason });
    }

    // Update booking status
    let booking;
    if (bookingType === "TestBooking") {
      const TestBooking = (await import("../../model/testBooking.model.js")).default;
      booking = await TestBooking.findOneAndUpdate(
        { _id: bookingId, labId },
        { bookingStatus: "Confirmed" },
        { new: true }
      );
    } else {
      const Booking = (await import("../../model/booking.model.js")).default;
      booking = await Booking.findOneAndUpdate(
        { _id: bookingId, registration: labId },
        { status: "Confirmed" },
        { new: true }
      );
    }

    // Increment booking count
    const sub = await LabSubscription.findOne({ labId });
    if (sub.subscriptionStatus === "active") {
      sub.bookingsThisWeek += 1;
      sub.bookingsThisMonth += 1;
      sub.bookingsThisYear += 1;
    } else {
      sub.freeBookingsUsed += 1;
    }
    sub.totalBookingsAccepted += 1;
    await sub.save();

    res.status(200).json({
      success: true,
      message: "Booking accepted successfully",
      data: booking,
      subscriptionInfo: {
        status: sub.subscriptionStatus,
        freeBookingsRemaining: sub.subscriptionStatus === "free"
          ? Math.max(0, sub.freeBookingsLimit - sub.freeBookingsUsed)
          : null,
        bookingsThisMonth: sub.bookingsThisMonth,
        monthlyLimit: sub.monthlyBookingLimit,
      },
    });
  } catch (err) {
    console.error("ACCEPT_BOOKING_ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// DECLINE BOOKING
export const declineBooking = async (req, res) => {
  try {
    const labId = req.user.id;
    const { bookingId, bookingType = "TestBooking", reason = "" } = req.body;

    if (!bookingId) return res.status(400).json({ success: false, message: "bookingId required" });

    // First check current booking status
    let existingBooking;
    if (bookingType === "TestBooking") {
      const TestBooking = (await import("../../model/testBooking.model.js")).default;
      existingBooking = await TestBooking.findOne({ _id: bookingId, labId });
    } else {
      const Booking = (await import("../../model/booking.model.js")).default;
      existingBooking = await Booking.findOne({ _id: bookingId, registration: labId });
    }

    if (!existingBooking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Check if already confirmed or cancelled
    const currentStatus = existingBooking.bookingStatus || existingBooking.status;
    if (currentStatus === "Confirmed") {
      return res.status(400).json({ success: false, message: "Cannot decline a confirmed booking" });
    }
    if (currentStatus === "Cancelled") {
      return res.status(400).json({ success: false, message: "Booking is already cancelled" });
    }

    // Update booking status
    let booking;
    if (bookingType === "TestBooking") {
      const TestBooking = (await import("../../model/testBooking.model.js")).default;
      booking = await TestBooking.findOneAndUpdate(
        { _id: bookingId, labId },
        { bookingStatus: "Cancelled", cancellationReason: reason },
        { new: true }
      );
    } else {
      const Booking = (await import("../../model/booking.model.js")).default;
      booking = await Booking.findOneAndUpdate(
        { _id: bookingId, registration: labId },
        { status: "Cancelled", cancellationReason: reason },
        { new: true }
      );
    }

    res.status(200).json({
      success: true,
      message: "Booking declined successfully",
      data: booking,
    });
  } catch (err) {
    console.error("DECLINE_BOOKING_ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════ ADMIN — GET ALL LAB SUBSCRIPTIONS ═══════════════════════

export const getAllLabSubscriptions = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = {};
    if (status) query.subscriptionStatus = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await LabSubscription.countDocuments(query);
    const subs = await LabSubscription.find(query)
      .populate("labId", "labName phone email city")
      .populate("packageId", "packageName price durationDays")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: subs,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    console.error("GET_ALL_LAB_SUBSCRIPTIONS_ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};


// ═══════════════════ TEST HELPER — GENERATE SIGNATURE ════════════════════════

export const generateTestSignature = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id) {
      return res.status(400).json({ 
        success: false, 
        message: "razorpay_order_id and razorpay_payment_id required" 
      });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    res.status(200).json({
      success: true,
      data: {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature: signature,
        note: "Use these values in /purchase/verify API"
      }
    });
  } catch (err) {
    console.error("GENERATE_TEST_SIGNATURE_ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
