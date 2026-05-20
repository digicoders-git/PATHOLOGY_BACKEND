import jwt from 'jsonwebtoken'

const generateToken = (id, role = "pathology") => {
  let token = jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' })
  return token
}
export default generateToken;