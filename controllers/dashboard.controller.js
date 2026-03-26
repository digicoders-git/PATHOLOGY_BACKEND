import Registration from "../model/registration.model.js";
import Parent from "../model/parent.model.js";
import TestService from "../model/testService.model.js";
import Category from "../model/category.model.js";
import Patient from "../model/patient/patient.model.js";
import Booking from "../model/booking.model.js";

export const getDashboardStats = async (req, res) => {
  try {
    const [registrations, parents, tests, categories, patients, bookings] = await Promise.all([
      Registration.countDocuments(),
      Parent.countDocuments(),
      TestService.countDocuments(),
      Category.countDocuments(),
      Patient.countDocuments(),
      Booking.countDocuments(),
    ]);

    // Registration Trend (Last 7 Days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const registrationTrend = await Registration.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Test Category Distribution
    const categoryDist = await TestService.aggregate([
      { $group: { _id: "$category_id", count: { $sum: 1 } } },
      { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "category" } },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      { $project: { name: { $ifNull: ["$category.name", "Uncategorized"] }, count: 1 } }
    ]);

    // Lab Status Distribution
    const statusDist = await Registration.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $project: { name: { $cond: { if: { $eq: ["$_id", true] }, then: "Active", else: "Pending" } }, count: 1 } }
    ]);

    // Recent Registrations
    const recentRegistrations = await Registration.find()
      .select("labName ownerName createdAt city status")
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        registrations,
        parents,
        tests,
        categories,
        patients,
        bookings,
        registrationTrend,
        categoryDist,
        statusDist,
        recentRegistrations
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats",
      error: error.message,
    });
  }
};
