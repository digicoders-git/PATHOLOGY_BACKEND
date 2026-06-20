import WalletTransaction from "../../model/walletTransaction.model.js";
import Registration from "../../model/registration.model.js";

// Get all withdrawal requests
export const getWithdrawalRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = { description: "Withdrawal Request", type: "debit" };
    
    if (status) {
      query.status = status; // pending, success, failed
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await WalletTransaction.countDocuments(query);
    
    const requests = await WalletTransaction.find(query)
      .populate("labId", "labName phone email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      }
    });
  } catch (error) {
    console.error("GET_WITHDRAWALS_ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update withdrawal status
export const updateWithdrawalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // "success" or "failed"

    if (!["success", "failed"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const transaction = await WalletTransaction.findById(id);
    
    if (!transaction) {
      return res.status(404).json({ success: false, message: "Withdrawal request not found" });
    }

    if (transaction.status !== "pending") {
      return res.status(400).json({ success: false, message: "Request has already been processed" });
    }

    transaction.status = status;
    await transaction.save();

    // If failed/rejected, refund the money to the Lab's wallet
    if (status === "failed") {
      const lab = await Registration.findById(transaction.labId);
      if (lab) {
        lab.walletBalance = (lab.walletBalance || 0) + transaction.amount;
        await lab.save();
        
        // Create a compensating credit transaction
        await WalletTransaction.create({
          labId: transaction.labId,
          amount: transaction.amount,
          type: "credit",
          description: "Withdrawal Request Rejected (Refund)",
          status: "success"
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Withdrawal request marked as ${status}`,
      data: transaction
    });

  } catch (error) {
    console.error("UPDATE_WITHDRAWAL_STATUS_ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
