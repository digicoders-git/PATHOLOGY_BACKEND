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
