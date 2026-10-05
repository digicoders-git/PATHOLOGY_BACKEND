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
        transactions: transactions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
