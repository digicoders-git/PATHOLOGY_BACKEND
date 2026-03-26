import jwt from 'jsonwebtoken'

const generateToken = (id, role = "admin") => {
  let token = jwt.sign({ id, role }, process.env.JWT_SECRET)
  return token
}
export default generateToken;