import generateToken from "../config/token.js"
import Admin from "../model/admin.models.js"
import bcrypt from 'bcryptjs'

// Helper to get local URL path
const getLocalUrl = (req, file) => {
  if (!file) return null;
  const relativePath = file.path.replace(/\\/g, "/");
  return `${req.protocol}://${req.get("host")}/${relativePath}`;
};

export const create = async (req, res) => {
  try {
    const { name, email, password } = req.body
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All Fields must me required" })
    }
    const existAdmin = await Admin.findOne({ email })
    if (existAdmin) {
      return res.status(400).json({ message: "User already Exist !" })
    }
    const hashedPassword = await bcrypt.hash(password, 10)
    let profilePhotoUrl = "";
    if (req.file) {
      profilePhotoUrl = getLocalUrl(req, req.file);
    }

    const admin = await Admin.create({
      name,
      email,
      password: hashedPassword,
      profilePhoto: profilePhotoUrl
    })
    return res.status(201).json({ message: "Admin created", admin })
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error !", error: error.message })
  }
}


export const login = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ message: "Please Enter email or password !" })
    }
    const existAdmin = await Admin.findOne({ email })
    if (!existAdmin) {
      return res.status(400).json({ message: "Admin not Found !" })
    }
    const passMatch = await bcrypt.compare(password, existAdmin.password)
    if (!passMatch) {
      return res.status(400).json({ message: "incorrect password !" })
    }
    let token;
    try {
      token = generateToken(existAdmin._id)
    } catch (error) {
      return res.status(500).json({ message: "Token not found !" })
    }
    return res.status(200).json({
      _id: existAdmin._id,
      email: existAdmin.email,
      password: existAdmin.password,
      profilePhoto: existAdmin.profilePhoto,
      token
    })
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error !", error: error.message })
  }
}

export const get = async (req, res) => {
  try {
    const data = await Admin.find()
    return res.status(200).json({ message: "Admin Found", data })
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error !", error: error.message })
  }
}

export const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedAdmin = await Admin.findByIdAndDelete(id);

    if (!deletedAdmin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    return res.status(200).json({ message: "Admin deleted successfully", deletedAdmin });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
}

export const updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password } = req.body;

    const admin = await Admin.findById(id);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Update fields if provided
    if (name) admin.name = name;
    if (email) admin.email = email;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      admin.password = hashedPassword;
    }

    // Update profile photo if provided locally
    if (req.file) {
      admin.profilePhoto = getLocalUrl(req, req.file);
    }

    await admin.save();

    return res.status(200).json({ message: "Admin updated successfully", admin });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
}

export const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await Admin.findById(id);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }
    return res.status(200).json({ message: "Admin Found", data: admin });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
}
