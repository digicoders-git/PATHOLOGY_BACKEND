import Transaction from "../../model/transaction.model.js";
import Patient from "../../model/patient/patient.model.js";

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
