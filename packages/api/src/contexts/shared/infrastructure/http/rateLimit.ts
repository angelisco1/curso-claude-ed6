import type { Request, RequestHandler } from 'express'
import { rateLimit, ipKeyGenerator } from 'express-rate-limit'

export interface AuthRateLimitOptions {
    loginMax?: number
    loginWindowMs?: number
    registerMax?: number
    registerWindowMs?: number
}

export interface AuthRateLimiters {
    loginLimiter: RequestHandler
    registerLimiter: RequestHandler
}

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS

const readPositiveInt = (name: string, fallback: number): number => {
    const value = Number(process.env[name])
    return Number.isInteger(value) && value > 0 ? value : fallback
}

const clientIp = (req: Request): string => ipKeyGenerator(req.ip ?? '')

const loginKey = (req: Request): string => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    return `${clientIp(req)}|${email}`
}

const tooManyRequests: RequestHandler = (_req, res) => {
    res.status(429).json({ error: 'TooManyRequests', message: 'Demasiados intentos, inténtalo más tarde' })
}

export const createAuthRateLimiters = (options: AuthRateLimitOptions = {}): AuthRateLimiters => {
    const common = { standardHeaders: true, legacyHeaders: false, handler: tooManyRequests }

    return {
        loginLimiter: rateLimit({
            ...common,
            windowMs: options.loginWindowMs ?? readPositiveInt('AUTH_LOGIN_WINDOW_MS', 15 * MINUTE_MS),
            limit: options.loginMax ?? readPositiveInt('AUTH_LOGIN_MAX', 10),
            keyGenerator: loginKey
        }),
        registerLimiter: rateLimit({
            ...common,
            windowMs: options.registerWindowMs ?? readPositiveInt('AUTH_REGISTER_WINDOW_MS', HOUR_MS),
            limit: options.registerMax ?? readPositiveInt('AUTH_REGISTER_MAX', 5),
            keyGenerator: clientIp
        })
    }
}
