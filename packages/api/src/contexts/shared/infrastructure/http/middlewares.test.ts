import { describe, expect, it, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import { getJwtSecret } from '@config/jwt.js'
import { authenticate, authorizeRestaurant, type AuthRequest, type AuthUser } from '@shared/infrastructure/http/middlewares.js'

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

describe('authorizeRestaurant', () => {
    const ejecutar = (user: AuthUser | undefined, restaurantId: string | undefined) => {
        const req = { user, params: { restaurantId } } as unknown as AuthRequest
        const res = crearRes()
        const next = vi.fn()
        authorizeRestaurant(req, res, next)
        return { res, next }
    }

    it('deja pasar al admin aunque no tenga restaurante', () => {
        const { next, res } = ejecutar({ id: 'a', role: 'admin', restaurantId: null }, 'r1')
        expect(next).toHaveBeenCalledOnce()
        expect(res.status).not.toHaveBeenCalled()
    })

    it('deja pasar a un empleado de su propio restaurante', () => {
        const { next } = ejecutar({ id: 'm', role: 'manager', restaurantId: 'r1' }, 'r1')
        expect(next).toHaveBeenCalledOnce()
    })

    it('responde 403 a un empleado de otro restaurante', () => {
        const { next, res } = ejecutar({ id: 'm', role: 'manager', restaurantId: 'r1' }, 'r2')
        expect(res.status).toHaveBeenCalledWith(403)
        expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden: Insufficient permissions' })
        expect(next).not.toHaveBeenCalled()
    })

    it('responde 403 a un usuario sin restaurante que no es admin', () => {
        const { next, res } = ejecutar({ id: 'c', role: 'cliente', restaurantId: null }, 'r1')
        expect(res.status).toHaveBeenCalledWith(403)
        expect(next).not.toHaveBeenCalled()
    })

    it('responde 403 si el parámetro restaurantId no existe', () => {
        const { next, res } = ejecutar({ id: 'm', role: 'manager', restaurantId: null }, undefined)
        expect(res.status).toHaveBeenCalledWith(403)
        expect(next).not.toHaveBeenCalled()
    })

    it('responde 403 si no hay usuario autenticado', () => {
        const { next, res } = ejecutar(undefined, 'r1')
        expect(res.status).toHaveBeenCalledWith(403)
        expect(next).not.toHaveBeenCalled()
    })
})
