import { describe, expect, it, vi, afterEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { getJwtSecret } from '@config/jwt.js'
import { BcryptAuthService } from '@employee/infrastructure/BcryptAuthService.js'

describe('BcryptAuthService.generateToken', () => {
    afterEach(() => vi.unstubAllEnvs())

    it('firma con el secreto centralizado y HS256', () => {
        const token = new BcryptAuthService().generateToken({ id: 'u1', role: 'admin', restaurantId: null })
        const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'], complete: true })
        expect(decoded.header.alg).toBe('HS256')
        expect(decoded.payload).toMatchObject({ id: 'u1', role: 'admin' })
    })

    it('caduca a los 15 minutos por defecto', () => {
        vi.stubEnv('JWT_EXPIRES_IN', '')
        const token = new BcryptAuthService().generateToken({ id: 'u1', role: 'admin', restaurantId: null })
        const { iat, exp } = jwt.decode(token) as { iat: number; exp: number }
        expect(exp - iat).toBe(15 * 60)
    })
})
