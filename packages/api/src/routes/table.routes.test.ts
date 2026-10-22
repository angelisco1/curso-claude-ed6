import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../app.js'
import { setupTestDatabase, tokenFor, bearer, seedTwoRestaurants, type SeededRestaurants } from '../test/http-helpers.js'

setupTestDatabase()

describe('mesas de staff (/api/v1/restaurants/:restaurantId/tables)', () => {
    let seed: SeededRestaurants
    let admin: string

    beforeAll(async () => {
        seed = await seedTwoRestaurants()
        admin = bearer(tokenFor({ role: 'admin' }))
    })

    it('está montado en app: sin token responde 401 y con admin 200', async () => {
        const url = `/api/v1/restaurants/${seed.restaurantA}/tables`
        expect((await request(app).get(url)).body).toEqual({ error: 'No autorizado: no se ha enviado el token' })
        expect((await request(app).get(url).set('Authorization', admin)).status).toBe(200)
    })
})
