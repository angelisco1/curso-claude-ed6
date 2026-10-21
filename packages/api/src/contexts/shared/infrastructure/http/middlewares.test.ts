import { describe, expect, it, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import { getJwtSecret } from '@config/jwt.js'
import { authenticate, type AuthRequest } from '@shared/infrastructure/http/middlewares.js'

const crearRes = () => {
    const res: any = {}
    res.status = vi.fn().mockReturnValue(res)
    res.json = vi.fn().mockReturnValue(res)
    return res
}

const crearReq = (token?: string): AuthRequest =>
    ({ headers: token ? { authorization: `Bearer ${token}` } : {}, params: {} }) as unknown as AuthRequest

const firmar = (payload: object, algorithm: jwt.Algorithm = 'HS256') =>
    jwt.sign(payload, getJwtSecret(), { algorithm })

describe('authenticate', () => {
    it('acepta un token válido y rellena req.user', () => {
        const req = crearReq(firmar({ id: 'u1', role: 'manager', restaurantId: 'r1' }))
        const res = crearRes()
        const next = vi.fn()

        authenticate(req, res, next)

        expect(next).toHaveBeenCalledOnce()
        expect(req.user).toMatchObject({ id: 'u1', role: 'manager', restaurantId: 'r1' })
    })

    it('normaliza restaurantId ausente a null', () => {
        const req = crearReq(firmar({ id: 'u1', role: 'admin' }))
        const next = vi.fn()

        authenticate(req, crearRes(), next)

        expect(next).toHaveBeenCalledOnce()
        expect(req.user?.restaurantId).toBeNull()
    })

    it('rechaza un token firmado con otro algoritmo (HS384)', () => {
        const req = crearReq(firmar({ id: 'u1', role: 'admin', restaurantId: null }, 'HS384'))
        const res = crearRes()
        const next = vi.fn()

        authenticate(req, res, next)

        expect(res.status).toHaveBeenCalledWith(401)
        expect(next).not.toHaveBeenCalled()
    })

    it.each([
        ['sin role', { id: 'u1', restaurantId: null }],
        ['con role inválido', { id: 'u1', role: 'superuser', restaurantId: null }],
        ['sin id', { role: 'admin', restaurantId: null }],
        ['con id no string', { id: 5, role: 'admin', restaurantId: null }]
    ])('rechaza con 401 un payload %s', (_nombre, payload) => {
        const req = crearReq(firmar(payload))
        const res = crearRes()
        const next = vi.fn()

        authenticate(req, res, next)

        expect(res.status).toHaveBeenCalledWith(401)
        expect(next).not.toHaveBeenCalled()
    })

    it('rechaza con 401 si no hay token', () => {
        const res = crearRes()
        const next = vi.fn()

        authenticate(crearReq(), res, next)

        expect(res.status).toHaveBeenCalledWith(401)
        expect(next).not.toHaveBeenCalled()
    })
})
