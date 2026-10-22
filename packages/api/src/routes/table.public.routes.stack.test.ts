import { beforeAll, describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import router from './table.public.routes.js'
import { errorHandler } from '@shared/infrastructure/http/errorHandler.js'
import { setupTestDatabase, tokenFor, bearer, seedTwoRestaurants, createClient, insertTable, type SeededRestaurants } from '../test/http-helpers.js'

// Prueba el router público aislado (montado en una app mínima); el comportamiento completo
// a través de app.ts se prueba en table.public.routes.test.ts.
setupTestDatabase()

const app = express()
app.use(express.json())
app.use('/p/:restaurantId/tables', router)
app.use(errorHandler)

describe('table.public.routes (router de cliente)', () => {
    let seed: SeededRestaurants
    let tableId: string

    beforeAll(async () => {
        seed = await seedTwoRestaurants()
        tableId = await insertTable(seed.restaurantA, { number: 1, capacity: 4 })
    })

    it('GET /available no exige token', async () => {
        const res = await request(app).get(`/p/${seed.restaurantA}/tables/available?people=2`)
        expect(res.status).toBe(200)
        expect(res.body).toHaveLength(1)
        expect(res.body[0]).not.toHaveProperty('occupiedBy')
    })

    it('GET /mine y POST /:id/occupy exigen token de cliente', async () => {
        const camarero = bearer(tokenFor({ role: 'camarero', restaurantId: seed.restaurantA }))
        expect((await request(app).get(`/p/${seed.restaurantA}/tables/mine`)).status).toBe(401)
        expect((await request(app).post(`/p/${seed.restaurantA}/tables/${tableId}/occupy`)).status).toBe(401)
        expect((await request(app).get(`/p/${seed.restaurantA}/tables/mine`).set('Authorization', camarero)).status).toBe(403)
        expect((await request(app).post(`/p/${seed.restaurantA}/tables/${tableId}/occupy`).set('Authorization', camarero)).status).toBe(403)
    })

    it('un cliente ocupa la mesa y la recupera con /mine', async () => {
        const cliente = await createClient()
        const ocupada = await request(app).post(`/p/${seed.restaurantA}/tables/${tableId}/occupy`).set('Authorization', cliente.auth)
        expect(ocupada.status).toBe(200)
        expect(ocupada.body).toMatchObject({ id: tableId, status: 'ocupada' })
        const mine = await request(app).get(`/p/${seed.restaurantA}/tables/mine`).set('Authorization', cliente.auth)
        expect(mine.status).toBe(200)
        expect(mine.body.id).toBe(tableId)
    })
})
