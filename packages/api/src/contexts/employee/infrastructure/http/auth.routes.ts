import { Router } from 'express'
import { authController } from '@employee/infrastructure/http/dependencies.js'
import { createAuthRateLimiters } from '@shared/infrastructure/http/rateLimit.js'

const { loginLimiter, registerLimiter } = createAuthRateLimiters()

const router = Router()

router.post('/login', loginLimiter, authController.login)
router.post('/register', registerLimiter, authController.register)

export default router
