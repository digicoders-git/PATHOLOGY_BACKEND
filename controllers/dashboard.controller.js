import Registration from "../model/registration.model.js";
import Parent from "../model/parent.model.js";
import TestService from "../model/testService.model.js";

export const getDashboardStats = async (req, res) => {
  try {
    const [registrations, parents, tests] = await Promise.all([
      Registration.countDocuments(),
      Parent.countDocuments(),
      TestService.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        registrations,
        parents,
        tests,
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
