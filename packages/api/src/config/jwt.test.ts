import { afterEach, describe, expect, it, vi } from 'vitest'
import { getJwtSecret, getAccessTokenExpiresIn, JWT_ALGORITHM } from '@config/jwt.js'

describe('config/jwt', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('devuelve un secreto fijo con NODE_ENV=test', () => {
        vi.stubEnv('NODE_ENV', 'test')
        vi.stubEnv('JWT_SECRET', '')
        expect(getJwtSecret()).toBe('test-secret')
    })

    it('lanza si falta JWT_SECRET fuera de test', () => {
        vi.stubEnv('NODE_ENV', 'production')
        vi.stubEnv('JWT_SECRET', '')
        expect(() => getJwtSecret()).toThrow('JWT_SECRET no está definido')
    })

    it('devuelve JWT_SECRET cuando está definido fuera de test', () => {
        vi.stubEnv('NODE_ENV', 'development')
        vi.stubEnv('JWT_SECRET', 'mi-secreto')
        expect(getJwtSecret()).toBe('mi-secreto')
    })

    it('usa HS256 como algoritmo', () => {
        expect(JWT_ALGORITHM).toBe('HS256')
    })

    it('la caducidad del access token es 15m por defecto y configurable', () => {
        vi.stubEnv('JWT_EXPIRES_IN', '')
        expect(getAccessTokenExpiresIn()).toBe('15m')
        vi.stubEnv('JWT_EXPIRES_IN', '8h')
        expect(getAccessTokenExpiresIn()).toBe('8h')
    })
})
