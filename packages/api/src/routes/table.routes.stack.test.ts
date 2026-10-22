import { beforeAll, describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import router from './table.routes.js'
import { errorHandler } from '@shared/infrastructure/http/errorHandler.js'
import { setupTestDatabase, tokenFor, bearer, seedTwoRestaurants, type SeededRestaurants } from '../test/http-helpers.js'

// Prueba el router de staff aislado (montado en una app mínima); el comportamiento completo
// a través de app.ts se prueba en table.routes.test.ts.
setupTestDatabase()

const app = express()
app.use(express.json())
app.use('/r/:restaurantId/tables', router)
app.use(errorHandler)

describe('table.routes (router de staff)', () => {
    let seed: SeededRestaurants
    let admin: string

    beforeAll(async () => {
        seed = await seedTwoRestaurants()
        admin = bearer(tokenFor({ role: 'admin' }))
    })

    it('compone dependencias reales: el admin crea, lista, consulta, edita, cambia estado y borra', async () => {
        const base = `/r/${seed.restaurantA}/tables`
        const creada = await request(app).post(base).set('Authorization', admin).send({ number: 1, capacity: 4 })
        expect(creada.status).toBe(201)
        const id = creada.body.id

        expect((await request(app).get(base).set('Authorization', admin)).body).toHaveLength(1)
        expect((await request(app).get(`${base}/${id}`).set('Authorization', admin)).status).toBe(200)
        expect((await request(app).put(`${base}/${id}`).set('Authorization', admin).send({ number: 2, capacity: 4 })).body.number).toBe(2)
        expect((await request(app).patch(`${base}/${id}/status`).set('Authorization', admin).send({ status: 'reservada' })).body.status).toBe('reservada')
        expect((await request(app).delete(`${base}/${id}`).set('Authorization', admin)).status).toBe(204)
    })

    it.each([
        ['get', '/', ['admin', 'manager', 'camarero', 'cocinero']],
        ['get', '/x', ['admin', 'manager', 'camarero', 'cocinero']],
        ['post', '/', ['admin']],
        ['put', '/x', ['admin']],
        ['delete', '/x', ['admin']],
        ['patch', '/x/status', ['admin', 'manager', 'camarero']]
    ] as const)('%s %s solo permite %j', async (method, path, permitidos) => {
        for (const role of ['admin', 'manager', 'camarero', 'cocinero', 'cliente']) {
            const token = bearer(tokenFor({ role, restaurantId: role === 'admin' || role === 'cliente' ? null : seed.restaurantA }))
            const res = await request(app)[method](`/r/${seed.restaurantA}/tables${path}`).set('Authorization', token).send({})
            if ((permitidos as readonly string[]).includes(role)) {
                expect(res.status, `${role} debería pasar la autorización`).not.toBe(403)
            } else {
                expect(res.status, `${role} debería recibir 403`).toBe(403)
            }
        }
    })

    it('exige token y pertenecer al restaurante', async () => {
        expect((await request(app).get(`/r/${seed.restaurantA}/tables`)).status).toBe(401)
        const managerB = bearer(tokenFor({ role: 'manager', restaurantId: seed.restaurantB }))
        expect((await request(app).get(`/r/${seed.restaurantA}/tables`).set('Authorization', managerB)).status).toBe(403)
    })
})
