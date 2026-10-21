import type { SignOptions } from 'jsonwebtoken'

export const JWT_ALGORITHM = 'HS256' as const

export const getJwtSecret = (): string => {
    if (process.env.NODE_ENV === 'test') {
        return 'test-secret'
    }
    const secret = process.env.JWT_SECRET
    if (!secret) {
        throw new Error('JWT_SECRET no está definido')
    }
    return secret
}

export const getAccessTokenExpiresIn = (): NonNullable<SignOptions['expiresIn']> =>
    (process.env.JWT_EXPIRES_IN || '15m') as NonNullable<SignOptions['expiresIn']>
