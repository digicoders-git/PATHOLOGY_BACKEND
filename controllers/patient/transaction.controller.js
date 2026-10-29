import Transaction from "../../model/transaction.model.js";
import Patient from "../../model/patient/patient.model.js";
import mongoose from "mongoose";

/**
 * Get patient's transaction history
 */
export const getMyTransactions = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const total = await Transaction.countDocuments({ userId: patientId, userType: 'Patient' });
    
    const transactions = await Transaction.find({ userId: patientId, userType: 'Patient' })
      .populate({
        path: 'relatedBooking',
        select: 'bookingId bookingDate slotId',
        populate: { path: 'slotId', select: 'startTime endTime date' }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: transactions.length,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      },
      data: transactions,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get patient's wallet data (balance + transactions)
 */
export const getWalletData = async (req, res) => {
  try {
    const patientId = req.user.id;
    
    // Fetch patient to get wallet balance
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    // Fetch transactions
    const transactions = await Transaction.find({ userId: patientId, userType: 'Patient' })
      .populate({
        path: 'relatedBooking',
        select: 'bookingId bookingDate slotId',
        populate: { path: 'slotId', select: 'startTime endTime date' }
      })
      .sort({ createdAt: -1 })
      .limit(50); // Get latest 50 for wallet screen

    res.json({
      success: true,
      data: {
        walletBalance: patient.walletBalance || 0,
        claimedOffers: (patient.claimedOffers || []).map(id => id.toString()),
        transactions: transactions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Claim offer / coupon code to get coins in wallet
 */
export const claimOfferCoupon = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { couponCode, offerId } = req.body;

    const Offer = (await import("../../model/offer.model.js")).default;
    let query = { status: true };
    if (offerId) {
      query._id = offerId;
    } else if (couponCode) {
      query.couponCode = { $regex: new RegExp("^" + couponCode.trim() + "$", "i") };
    } else {
      return res.status(400).json({ success: false, message: "Coupon code or offer ID is required" });
    }

    const offer = await Offer.findOne(query);
    if (!offer) {
      return res.status(404).json({ success: false, message: "Offer or coupon not found or inactive" });
    }

    // Check if patient already claimed this offer (by offerId — reliable)
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    const alreadyClaimed = patient.claimedOffers?.some(
      (id) => id.toString() === offer._id.toString()
    );

    if (alreadyClaimed) {
      return res.status(400).json({
        success: false,
        message: "You have already claimed this offer!",
        alreadyClaimed: true,
        offerId: offer._id.toString(),
      });
    }

    // Determine coins to reward
    let coinsToReward = Number(offer.coinsReward) || 0;
    if (!coinsToReward || coinsToReward <= 0) {
      if (offer.discountAmount && offer.discountAmount > 0) {
        coinsToReward = Math.min(offer.discountAmount, 200);
      } else if (offer.discountPercent && offer.discountPercent > 0) {
        coinsToReward = Math.round(offer.discountPercent * 2);
      } else {
        coinsToReward = 50;
      }
    }

    // Update patient wallet + mark offer as claimed atomically
    const updatedPatient = await Patient.findByIdAndUpdate(
      patientId,
      {
        $inc: { walletBalance: coinsToReward },
        $addToSet: { claimedOffers: offer._id },
      },
      { new: true }
    );

    // Create transaction record
    await Transaction.create({
      userId: patientId,
      userType: 'Patient',
      amount: coinsToReward,
      type: 'credit',
      status: 'success',
      description: `Offer Claimed: ${offer.title} (${offer.couponCode || 'PROMO'})`,
    });

    return res.json({
      success: true,
      message: `Congratulations! ${coinsToReward} Labo Coins added to your wallet!`,
      coinsAdded: coinsToReward,
      walletBalance: updatedPatient.walletBalance,
      offerId: offer._id.toString(),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * ONE-TIME MIGRATION: Backfill claimedOffers for all patients
 * who already claimed offers via transaction history
 * POST /admin/migrate-claimed-offers
 */
export const migrateClaimedOffers = async (req, res) => {
  try {
    const Offer = (await import("../../model/offer.model.js")).default;

    // Get all offers to build couponCode -> _id map
    const allOffers = await Offer.find({}, "_id title couponCode");
    const offerMap = {}; // couponCode.toLowerCase() -> offerId
    const titleMap = {}; // title keyword -> offerId
    for (const o of allOffers) {
      if (o.couponCode?.trim()) {
        offerMap[o.couponCode.trim().toLowerCase()] = o._id;
      }
      if (o.title?.trim()) {
        titleMap[o.title.trim().toLowerCase()] = o._id;
      }
    }

    // Find all "Offer Claimed" transactions
    const claimTxs = await Transaction.find({
      userType: "Patient",
      type: "credit",
      description: { $regex: /Offer Claimed/i },
    }).select("userId description");

    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (const tx of claimTxs) {
      try {
        // Extract coupon code from description: "Offer Claimed: Title (COUPONCODE)"
        let matchedOfferId = null;

        const parenMatch = tx.description.match(/\(([^)]+)\)$/);
        if (parenMatch) {
          const code = parenMatch[1].trim().toLowerCase();
          if (code !== "promo" && offerMap[code]) {
            matchedOfferId = offerMap[code];
          }
        }

        // Fallback: match by title keyword
        if (!matchedOfferId) {
          const titlePart = tx.description
            .replace(/^Offer Claimed:\s*/i, "")
            .replace(/\s*\([^)]*\)$/, "")
            .trim()
            .toLowerCase();
          if (titleMap[titlePart]) {
            matchedOfferId = titleMap[titlePart];
          }
        }

        if (!matchedOfferId) {
          skipped++;
          continue;
        }

        // Add to patient's claimedOffers (no duplicates via $addToSet)
        const result = await Patient.updateOne(
          { _id: tx.userId },
          { $addToSet: { claimedOffers: matchedOfferId } }
        );

        if (result.modifiedCount > 0) updated++;
        else skipped++;
      } catch (e) {
        errors.push(`tx ${tx._id}: ${e.message}`);
      }
    }

    return res.json({
      success: true,
      message: `Migration complete. ${updated} patient records updated, ${skipped} skipped.`,
      totalTransactionsScanned: claimTxs.length,
      updated,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
