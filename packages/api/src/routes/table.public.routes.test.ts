import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../app.js'
import { setupTestDatabase, seedTwoRestaurants, insertTable, createClient, tokenFor, bearer, type SeededRestaurants } from '../test/http-helpers.js'

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

    describe('GET /available', () => {
        let restaurante: string

        beforeAll(async () => {
            restaurante = (await seedTwoRestaurants()).restaurantA
            await insertTable(restaurante, { number: 1, capacity: 6 })
            await insertTable(restaurante, { number: 2, capacity: 2 })
            await insertTable(restaurante, { number: 3, capacity: 4 })
            await insertTable(restaurante, { number: 4, capacity: 8, status: 'reservada' })
            await insertTable(restaurante, { number: 5, capacity: 8, status: 'ocupada' })
        })

        it('solo devuelve libres con capacidad suficiente, ordenadas y sin occupiedBy', async () => {
            const res = await request(app).get(`/api/v1/public/restaurants/${restaurante}/tables/available?people=3`)
            expect(res.status).toBe(200)
            expect(res.body.map((t: { number: number }) => t.number)).toEqual([3, 1])
            expect(Object.keys(res.body[0]).sort()).toEqual(['capacity', 'createdAt', 'description', 'id', 'number', 'restaurantId', 'status', 'updatedAt'])
        })

        it('un restaurante inexistente devuelve []', async () => {
            const res = await request(app).get('/api/v1/public/restaurants/no-existe/tables/available?people=2')
            expect(res.status).toBe(200)
            expect(res.body).toEqual([])
        })

        it.each(['people=0', 'people=abc', 'people=2.5', 'people=-1', ''])('?%s -> 400 InvalidPeopleCountError', async (query) => {
            const res = await request(app).get(`/api/v1/public/restaurants/${restaurante}/tables/available?${query}`)
            expect(res.status).toBe(400)
            expect(res.body).toEqual({ error: 'InvalidPeopleCountError', message: 'El número de personas debe ser un entero mayor que 0' })
        })
    })

    describe('ocupar y recuperar mesa', () => {
        let restaurante: string
        let otroRestaurante: string
        const occupy = (restaurantId: string, id: string, auth?: string) => {
            const req = request(app).post(`/api/v1/public/restaurants/${restaurantId}/tables/${id}/occupy`)
            return auth ? req.set('Authorization', auth) : req
        }
        const mine = (restaurantId: string, auth: string) =>
            request(app).get(`/api/v1/public/restaurants/${restaurantId}/tables/mine`).set('Authorization', auth)

        beforeAll(async () => {
            const nuevo = await seedTwoRestaurants()
            restaurante = nuevo.restaurantA
            otroRestaurante = nuevo.restaurantB
        })

        it('occupy sin token -> 401 y con token de empleado -> 403', async () => {
            const mesa = await insertTable(restaurante, { number: 10 })
            const sinToken = await occupy(restaurante, mesa)
            expect(sinToken.status).toBe(401)
            expect(sinToken.body).toEqual({ error: 'No autorizado: no se ha enviado el token' })
            const camarero = bearer(tokenFor({ role: 'camarero', restaurantId: restaurante }))
            const res = await occupy(restaurante, mesa, camarero)
            expect(res.status).toBe(403)
            expect(res.body).toEqual({ error: 'Prohibido: permisos insuficientes' })
        })

        it('el cliente ocupa una mesa (idempotente) y /mine la devuelve', async () => {
            const cliente = await createClient()
            const mesa = await insertTable(restaurante, { number: 11 })
            expect((await mine(restaurante, cliente.auth)).status).toBe(404)

            const res = await occupy(restaurante, mesa, cliente.auth)
            expect(res.status).toBe(200)
            expect(res.body).toMatchObject({ id: mesa, number: 11, status: 'ocupada' })
            expect(res.body).not.toHaveProperty('occupiedBy')

            expect((await occupy(restaurante, mesa, cliente.auth)).status).toBe(200)

            const suya = await mine(restaurante, cliente.auth)
            expect(suya.status).toBe(200)
            expect(suya.body.id).toBe(mesa)
            expect(suya.body).not.toHaveProperty('occupiedBy')
        })

        it('una segunda mesa del mismo cliente, aquí o en otro restaurante -> 409 ClientAlreadyHasTableError', async () => {
            const cliente = await createClient()
            await occupy(restaurante, await insertTable(restaurante, { number: 12 }), cliente.auth)
            for (const [restaurantId, number] of [[restaurante, 13], [otroRestaurante, 13]] as const) {
                const res = await occupy(restaurantId, await insertTable(restaurantId, { number }), cliente.auth)
                expect(res.status).toBe(409)
                expect(res.body).toEqual({ error: 'ClientAlreadyHasTableError', message: 'Ya tienes una mesa ocupada' })
            }
            expect((await mine(otroRestaurante, cliente.auth)).status).toBe(404)
        })

        it('una mesa ocupada por otro o reservada -> 409 TableNotAvailableError', async () => {
            const uno = await createClient()
            const dos = await createClient()
            const mesa = await insertTable(restaurante, { number: 14 })
            await occupy(restaurante, mesa, uno.auth)
            const res = await occupy(restaurante, mesa, dos.auth)
            expect(res.status).toBe(409)
            expect(res.body).toEqual({ error: 'TableNotAvailableError', message: 'La mesa ya no está disponible' })
            const reservada = await insertTable(restaurante, { number: 15, status: 'reservada' })
            expect((await occupy(restaurante, reservada, dos.auth)).status).toBe(409)
        })

        it('una mesa inexistente o de otro restaurante -> 404 TableNotFoundError', async () => {
            const cliente = await createClient()
            const mesaOtro = await insertTable(otroRestaurante, { number: 20 })
            const res = await occupy(restaurante, mesaOtro, cliente.auth)
            expect(res.status).toBe(404)
            expect(res.body).toEqual({ error: 'TableNotFoundError', message: 'Mesa no encontrada' })
            expect((await occupy(restaurante, 'no-existe', cliente.auth)).status).toBe(404)
        })

        it('tras liberarla un camarero, el cliente puede ocupar otra', async () => {
            const cliente = await createClient()
            const primera = await insertTable(restaurante, { number: 30 })
            const segunda = await insertTable(restaurante, { number: 31 })
            await occupy(restaurante, primera, cliente.auth)
            const camarero = bearer(tokenFor({ role: 'camarero', restaurantId: restaurante }))
            await request(app).patch(`/api/v1/restaurants/${restaurante}/tables/${primera}/status`).set('Authorization', camarero).send({ status: 'libre' })
            expect((await occupy(restaurante, segunda, cliente.auth)).status).toBe(200)
        })
    })
})
