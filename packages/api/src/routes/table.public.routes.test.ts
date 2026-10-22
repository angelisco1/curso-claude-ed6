import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../app.js'
import { setupTestDatabase, seedTwoRestaurants, insertTable, type SeededRestaurants } from '../test/http-helpers.js'

setupTestDatabase()

describe('mesas públicas (/api/v1/public/restaurants/:restaurantId/tables)', () => {
    let seed: SeededRestaurants

    beforeAll(async () => {
        seed = await seedTwoRestaurants()
        await insertTable(seed.restaurantA, { number: 1, capacity: 4 })
    })

    it('está montado en app: available responde sin token', async () => {
        const res = await request(app).get(`/api/v1/public/restaurants/${seed.restaurantA}/tables/available?people=2`)
        expect(res.status).toBe(200)
        expect(res.body).toHaveLength(1)
    })
})
