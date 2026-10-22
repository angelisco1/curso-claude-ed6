import { afterEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createAuthRateLimiters, type AuthRateLimitOptions } from '@shared/infrastructure/http/rateLimit.js'

const crearApp = (options?: AuthRateLimitOptions) => {
    const { loginLimiter, registerLimiter } = createAuthRateLimiters(options)
    const app = express()
    app.set('trust proxy', true)
    app.use(express.json())
    app.post('/login', loginLimiter, (_req, res) => { res.status(200).json({ ok: true }) })
    app.post('/register', registerLimiter, (_req, res) => { res.status(201).json({ ok: true }) })
    return app
}

const login = (app: express.Express, email: string, ip = '1.1.1.1') =>
    request(app).post('/login').set('X-Forwarded-For', ip).send({ email })

describe('createAuthRateLimiters', () => {
    afterEach(() => vi.unstubAllEnvs())

    it('login: el intento N+1 del mismo email e IP devuelve 429 con mensaje en español', async () => {
        const app = crearApp({ loginMax: 3 })
        for (let i = 0; i < 3; i++) {
            expect((await login(app, 'a@x.com')).status).toBe(200)
        }
        const res = await login(app, 'a@x.com')
        expect(res.status).toBe(429)
        expect(res.body).toEqual({ error: 'TooManyRequests', message: 'Demasiados intentos, inténtalo más tarde' })
    })

    it('login: otro email desde la misma IP no se ve afectado', async () => {
        const app = crearApp({ loginMax: 2 })
        await login(app, 'a@x.com'); await login(app, 'a@x.com')
        expect((await login(app, 'a@x.com')).status).toBe(429)
        expect((await login(app, 'b@x.com')).status).toBe(200)
    })

    it('login: otra IP con el mismo email no se ve afectada', async () => {
        const app = crearApp({ loginMax: 2 })
        await login(app, 'a@x.com'); await login(app, 'a@x.com')
        expect((await login(app, 'a@x.com')).status).toBe(429)
        expect((await login(app, 'a@x.com', '2.2.2.2')).status).toBe(200)
    })

    it('login: el email se compara sin distinguir mayúsculas ni espacios', async () => {
        const app = crearApp({ loginMax: 2 })
        await login(app, 'a@x.com'); await login(app, ' A@X.com ')
        expect((await login(app, 'a@X.COM')).status).toBe(429)
    })

    it('login: un cuerpo sin email sigue limitado por IP', async () => {
        const app = crearApp({ loginMax: 1 })
        expect((await request(app).post('/login').send({})).status).toBe(200)
        expect((await request(app).post('/login').send({})).status).toBe(429)
    })

    it('register: limita por IP, con independencia del email', async () => {
        const app = crearApp({ registerMax: 2 })
        const reg = (ip: string, email: string) => request(app).post('/register').set('X-Forwarded-For', ip).send({ email })
        expect((await reg('1.1.1.1', 'a@x.com')).status).toBe(201)
        expect((await reg('1.1.1.1', 'b@x.com')).status).toBe(201)
        const bloqueado = await reg('1.1.1.1', 'c@x.com')
        expect(bloqueado.status).toBe(429)
        expect(bloqueado.body.error).toBe('TooManyRequests')
        expect((await reg('2.2.2.2', 'a@x.com')).status).toBe(201)
    })

    it('por defecto: login 10 intentos y register 5', async () => {
        const app = crearApp()
        for (let i = 0; i < 10; i++) expect((await login(app, 'a@x.com')).status).toBe(200)
        expect((await login(app, 'a@x.com')).status).toBe(429)
        for (let i = 0; i < 5; i++) expect((await request(app).post('/register').send({})).status).toBe(201)
        expect((await request(app).post('/register').send({})).status).toBe(429)
    })

    it('los límites se pueden bajar con variables de entorno', async () => {
        vi.stubEnv('AUTH_LOGIN_MAX', '1')
        vi.stubEnv('AUTH_REGISTER_MAX', '1')
        const app = crearApp()
        expect((await login(app, 'a@x.com')).status).toBe(200)
        expect((await login(app, 'a@x.com')).status).toBe(429)
        expect((await request(app).post('/register').send({})).status).toBe(201)
        expect((await request(app).post('/register').send({})).status).toBe(429)
    })
})
