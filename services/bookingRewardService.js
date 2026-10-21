import Registration from "../model/registration.model.js";
import WalletTransaction from "../model/walletTransaction.model.js";
import LabNotification from "../model/labNotification.model.js";
import TestBooking from "../model/testBooking.model.js";
import Booking from "../model/booking.model.js";
import { sendNotificationToUser } from "./notificationService.js";

/**
 * Checks if this completed booking qualifies as the patient's first completed booking,
 * and if so, awards 100 points to the lab wallet with proper in-app and FCM push notifications.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.bookingId - ID of the booking being completed
 * @param {string|ObjectId} params.labId - ID of the lab (Registration)
 * @param {string|ObjectId} params.patientId - ID of the patient
 */
export async function rewardLabForFirstCompletedBooking({ bookingId, labId, patientId }) {
  try {
    if (!labId || !patientId || !bookingId) {
      console.log("[BookingReward] Missing labId, patientId or bookingId. Skipping reward check.");
      return { rewarded: false, reason: "missing_params" };
    }

    // 1. Idempotency check: has this booking already triggered the 100 points reward?
    const existingTx = await WalletTransaction.findOne({
      relatedBookingId: bookingId,
      description: "Patient First Booking Reward - 100 Points"
    });
    if (existingTx) {
      console.log(`[BookingReward] Booking ${bookingId} already rewarded. Skipping.`);
      return { rewarded: false, reason: "already_rewarded_for_this_booking" };
    }

    // 2. Check if the patient has had ANY OTHER completed booking before this one
    const [previousAppBookings, previousDirectBookings] = await Promise.all([
      TestBooking.countDocuments({
        patientId,
        bookingStatus: "Completed",
        _id: { $ne: bookingId }
      }),
      Booking.countDocuments({
        patient: patientId,
        status: "Completed",
        _id: { $ne: bookingId }
      })
    ]);

    if (previousAppBookings > 0 || previousDirectBookings > 0) {
      console.log(`[BookingReward] Patient ${patientId} already had prior completed bookings (${previousAppBookings} app, ${previousDirectBookings} direct). Not first completed.`);
      return { rewarded: false, reason: "not_first_completed_booking" };
    }

    // 3. Double-check: Has ANY reward already been granted for this patient across any booking?
    const [patientAppBookingIds, patientDirectBookingIds] = await Promise.all([
      TestBooking.find({ patientId }).select('_id').lean(),
      Booking.find({ patient: patientId }).select('_id').lean()
    ]);
    const allPatientBookingIds = [
      ...patientAppBookingIds.map(b => b._id),
      ...patientDirectBookingIds.map(b => b._id)
    ].filter(id => id.toString() !== bookingId.toString());

    if (allPatientBookingIds.length > 0) {
      const priorRewardTx = await WalletTransaction.findOne({
        relatedBookingId: { $in: allPatientBookingIds },
        description: "Patient First Booking Reward - 100 Points"
      });
      if (priorRewardTx) {
        console.log(`[BookingReward] A first booking reward was already granted for patient ${patientId} on a different booking.`);
        return { rewarded: false, reason: "prior_reward_already_granted" };
      }
    }

    // 4. Award 100 points to Lab's walletBalance
    const updatedLab = await Registration.findByIdAndUpdate(
      labId,
      { $inc: { walletBalance: 100 } },
      { new: true }
    );

    if (!updatedLab) {
      console.warn(`[BookingReward] Lab ${labId} not found when attempting to credit reward.`);
      return { rewarded: false, reason: "lab_not_found" };
    }

    // 5. Create WalletTransaction record
    await WalletTransaction.create({
      labId: labId,
      amount: 100,
      type: "credit",
      status: "success",
      description: "Patient First Booking Reward - 100 Points",
      relatedBookingId: bookingId
    });

    const rewardTitle = "First Booking Reward! 🎉";
    const rewardBody = "Congratulations! 100 points have been credited to your lab wallet on completion of patient's first booking.\n\n— Team Labo India";

    // 6. Create in-app LabNotification
    try {
      await LabNotification.create({
        labId: labId,
        title: rewardTitle,
        body: rewardBody,
        type: "WALLET",
        refId: bookingId
      });
    } catch (notifErr) {
      console.error("[BookingReward] Error saving in-app LabNotification:", notifErr);
    }

    // 7. Send FCM push notification to Lab
    try {
      await sendNotificationToUser(
        labId.toString(),
        rewardTitle,
        rewardBody,
        {
          type: "wallet",
          bookingId: bookingId.toString(),
          amount: "100"
        },
        "pathology"
      );
    } catch (pushErr) {
      console.error("[BookingReward] Error sending FCM push notification:", pushErr);
    }

    console.log(`[BookingReward] Successfully awarded 100 points to lab ${labId} on first completed booking ${bookingId}`);
    return { rewarded: true, newBalance: updatedLab.walletBalance };
  } catch (error) {
    console.error("[BookingReward] Error in rewardLabForFirstCompletedBooking:", error);
    return { rewarded: false, error: error.message };
  }
}
