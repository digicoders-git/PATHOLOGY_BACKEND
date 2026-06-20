import WalletTransaction from "../../model/walletTransaction.model.js";

/**
 * Get lab's wallet transaction history
 * Route: GET /pathology/wallet-transactions
 */
export const getMyWalletTransactions = async (req, res) => {
  try {
    const labId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const total = await WalletTransaction.countDocuments({ labId });

    const transactions = await WalletTransaction.find({ labId })
      .populate({
        path: "relatedBookingId",
        select: "bookingId totalAmount testAmount discount amountPaid",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      message: "Wallet transactions fetched successfully",
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      data: transactions,
    });
  } catch (error) {
    console.error("GET_WALLET_TRANSACTIONS_ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch wallet transactions",
      error: error.message,
    });
  }
};

// Request Wallet Withdrawal
export const requestWithdrawal = async (req, res) => {
  try {
    const labId = req.user.id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid withdrawal amount" });
    }

    const Registration = (await import("../../model/registration.model.js")).default;
    const lab = await Registration.findById(labId);

    if (!lab) {
      return res.status(404).json({ success: false, message: "Lab not found" });
    }

    if ((lab.walletBalance || 0) < amount) {
      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }

    // Deduct immediately
    lab.walletBalance -= amount;
    await lab.save();

    // Create pending debit transaction
    const transaction = await WalletTransaction.create({
      labId,
      amount,
      type: "debit",
      description: "Withdrawal Request",
      status: "pending"
    });

    res.status(200).json({
      success: true,
      message: "Withdrawal request submitted successfully",
      data: transaction,
      newBalance: lab.walletBalance
    });

  } catch (error) {
    console.error("REQUEST_WITHDRAWAL_ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
