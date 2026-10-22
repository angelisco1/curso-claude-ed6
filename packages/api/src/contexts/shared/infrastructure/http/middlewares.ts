import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { getJwtSecret, JWT_ALGORITHM } from '@config/jwt.js'
import { VALID_ROLES } from '@employee/domain/value-objects/Role.js'

export interface AuthUser {
    id: string
    role: string
    restaurantId: string | null
}

export interface AuthRequest extends Request {
    user?: AuthUser
}

const toAuthUser = (decoded: string | jwt.JwtPayload): AuthUser | null => {
    if (typeof decoded === 'string') return null
    const { id, role, restaurantId } = decoded
    if (typeof id !== 'string' || typeof role !== 'string' || !VALID_ROLES.includes(role)) return null
    if (restaurantId !== undefined && restaurantId !== null && typeof restaurantId !== 'string') return null
    return { id, role, restaurantId: restaurantId ?? null }
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: No token provided' })
        return
    }

    const tokenParts = authHeader.split(' ')
    const token = tokenParts[1]
    if (!token) {
        res.status(401).json({ error: 'Unauthorized: Malformed token' })
        return
    }

    try {
        const decoded = jwt.verify(token, getJwtSecret(), { algorithms: [JWT_ALGORITHM] })
        const user = toAuthUser(decoded)
        if (!user) {
            res.status(401).json({ error: 'Unauthorized: Invalid token' })
            return
        }
        req.user = user
        next()
    } catch {
        res.status(401).json({ error: 'Unauthorized: Invalid token' })
    }
}

export const authorize = (roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).json({ error: 'Forbidden: Insufficient permissions' })
            return
        }
        next()
    }
}

export const authorizeRestaurant = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const user = req.user
    if (user && (user.role === 'admin' || (user.restaurantId !== null && user.restaurantId === req.params.restaurantId))) {
        next()
        return
    }
    res.status(403).json({ error: 'Forbidden: Insufficient permissions' })
}
