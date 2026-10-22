import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { setupTestDatabase } from '../../../../test/http-helpers.js'

setupTestDatabase()

describe('rate limiting en /auth', () => {
    let app: Express

    const login = (email: string, password = 'incorrecta') =>
        request(app).post('/api/v1/auth/login').send({ email, password })

    const register = (email: string) =>
        request(app).post('/api/v1/auth/register').send({ firstName: 'Ana', lastName: 'Gil', email, password: 'password-largo-123' })

    beforeAll(async () => {
        vi.stubEnv('AUTH_LOGIN_MAX', '3')
        vi.stubEnv('AUTH_REGISTER_MAX', '3')
        app = (await import('../../../../app.js')).default
        expect((await register('existente@x.com')).status).toBe(201)
    })

    afterAll(() => {
        vi.unstubAllEnvs()
    })

    it('el intento N+1 de login con el mismo email devuelve 429', async () => {
        for (let i = 0; i < 3; i++) {
            expect((await login('victima@x.com')).status).toBe(401)
        }
        const res = await login('victima@x.com')
        expect(res.status).toBe(429)
        expect(res.body).toEqual({ error: 'TooManyRequests', message: 'Demasiados intentos, inténtalo más tarde' })
    })

    it('un email distinto no se ve afectado por el bloqueo', async () => {
        expect((await login('victima@x.com')).status).toBe(429)
        expect((await login('otro@x.com')).status).toBe(401)
        expect((await login('existente@x.com', 'password-largo-123')).status).toBe(200)
    })

    it('un login con credenciales incorrectas responde 401 con el mensaje en español', async () => {
        const res = await login('mensajes@x.com')
        expect(res.status).toBe(401)
        expect(res.body).toEqual({ error: 'InvalidCredentialsError', message: 'Credenciales inválidas' })
    })

    it('una ruta protegida sin token responde 401 con el mensaje en español', async () => {
        const res = await request(app).get('/api/v1/orders/mine')
        expect(res.status).toBe(401)
        expect(res.body).toEqual({ error: 'No autorizado: no se ha enviado el token' })
    })

    it('una ruta protegida con un token inválido responde 401 con el mensaje en español', async () => {
        const res = await request(app).get('/api/v1/orders/mine').set('Authorization', 'Bearer no-es-un-jwt')
        expect(res.status).toBe(401)
        expect(res.body).toEqual({ error: 'No autorizado: token inválido' })
    })

    it('el registro devuelve 429 al superar el límite por IP', async () => {
        expect((await register('nuevo1@x.com')).status).toBe(201)
        expect((await register('nuevo2@x.com')).status).toBe(201)
        expect((await register('nuevo3@x.com')).status).toBe(429)
    })
})
