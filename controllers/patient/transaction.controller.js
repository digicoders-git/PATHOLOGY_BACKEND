import Transaction from "../../model/transaction.model.js";

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
