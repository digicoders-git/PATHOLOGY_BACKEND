import express from 'express'
import { create, get, login, deleteAdmin, updateAdmin, getById } from '../controllers/admin.controller.js'

import upload from '../middleware/multer.js'

export const adminRoute = express.Router()

adminRoute.post('/create', upload.single('profilePhoto'), create)
adminRoute.get('/get', get)
adminRoute.post('/login', login)
adminRoute.delete('/delete/:id', deleteAdmin)
adminRoute.put('/update/:id', upload.single('profilePhoto'), updateAdmin)
adminRoute.get('/get/:id', getById)