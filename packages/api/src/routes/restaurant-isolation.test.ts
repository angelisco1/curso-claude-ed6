import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../app.js'
import { setupTestDatabase, tokenFor, bearer, seedTwoRestaurants, type SeededRestaurants } from '../test/http-helpers.js'

setupTestDatabase()

describe('aislamiento por restaurante en platos e ingredientes', () => {
    let seed: SeededRestaurants
    let managerA: string
    let cocineroA: string
    let admin: string

    const dishBody = { name: 'Nuevo plato', price: 8, category: 'principal' }
    const dishUpdate = { name: 'Plato editado', price: 9, category: 'principal', available: true, ingredients: [] }
    const ingredientBody = { name: 'Sal', unit: 'kg', currentStock: 3 }

    beforeAll(async () => {
        seed = await seedTwoRestaurants()
        managerA = bearer(tokenFor({ role: 'manager', restaurantId: seed.restaurantA }))
        cocineroA = bearer(tokenFor({ role: 'cocinero', restaurantId: seed.restaurantA }))
        admin = bearer(tokenFor({ role: 'admin' }))
    })

    describe('manager de A sobre los platos de B', () => {
        it('GET lista -> 403', async () => {
            const res = await request(app).get(`/api/v1/restaurants/${seed.restaurantB}/dishes`).set('Authorization', managerA)
            expect(res.status).toBe(403)
        })

        it('GET por id -> 403', async () => {
            const res = await request(app).get(`/api/v1/restaurants/${seed.restaurantB}/dishes/${seed.dishB}`).set('Authorization', managerA)
            expect(res.status).toBe(403)
        })

        it('POST -> 403 y no crea nada', async () => {
            const res = await request(app).post(`/api/v1/restaurants/${seed.restaurantB}/dishes`).set('Authorization', managerA).send(dishBody)
            expect(res.status).toBe(403)
            const lista = await request(app).get(`/api/v1/restaurants/${seed.restaurantB}/dishes`).set('Authorization', admin)
            expect(lista.body).toHaveLength(1)
        })

        it('PUT -> 403', async () => {
            const res = await request(app).put(`/api/v1/restaurants/${seed.restaurantB}/dishes/${seed.dishB}`).set('Authorization', managerA).send(dishUpdate)
            expect(res.status).toBe(403)
        })

        it('DELETE -> 403', async () => {
            const res = await request(app).delete(`/api/v1/restaurants/${seed.restaurantB}/dishes/${seed.dishB}`).set('Authorization', managerA)
            expect(res.status).toBe(403)
        })
    })

    describe('empleados de A sobre los ingredientes de B', () => {
        it('GET lista (manager y cocinero) -> 403', async () => {
            for (const token of [managerA, cocineroA]) {
                const res = await request(app).get(`/api/v1/restaurants/${seed.restaurantB}/ingredients`).set('Authorization', token)
                expect(res.status).toBe(403)
            }
        })

        it('GET por id -> 403', async () => {
            const res = await request(app).get(`/api/v1/restaurants/${seed.restaurantB}/ingredients/${seed.ingredientB}`).set('Authorization', cocineroA)
            expect(res.status).toBe(403)
        })

        it('POST -> 403', async () => {
            const res = await request(app).post(`/api/v1/restaurants/${seed.restaurantB}/ingredients`).set('Authorization', managerA).send(ingredientBody)
            expect(res.status).toBe(403)
        })

        it('PUT -> 403', async () => {
            const res = await request(app).put(`/api/v1/restaurants/${seed.restaurantB}/ingredients/${seed.ingredientB}`).set('Authorization', managerA).send(ingredientBody)
            expect(res.status).toBe(403)
        })

        it('DELETE -> 403', async () => {
            const res = await request(app).delete(`/api/v1/restaurants/${seed.restaurantB}/ingredients/${seed.ingredientB}`).set('Authorization', managerA)
            expect(res.status).toBe(403)
        })
    })

    describe('accesos legítimos', () => {
        it('manager de A lista y crea platos de A', async () => {
            const lista = await request(app).get(`/api/v1/restaurants/${seed.restaurantA}/dishes`).set('Authorization', managerA)
            expect(lista.status).toBe(200)
            const crea = await request(app).post(`/api/v1/restaurants/${seed.restaurantA}/dishes`).set('Authorization', managerA).send(dishBody)
            expect(crea.status).toBe(201)
        })

        it('manager de A lee un plato y un ingrediente de A', async () => {
            const plato = await request(app).get(`/api/v1/restaurants/${seed.restaurantA}/dishes/${seed.dishA}`).set('Authorization', managerA)
            expect(plato.status).toBe(200)
            const ing = await request(app).get(`/api/v1/restaurants/${seed.restaurantA}/ingredients/${seed.ingredientA}`).set('Authorization', managerA)
            expect(ing.status).toBe(200)
        })

        it('admin accede a platos e ingredientes de cualquier restaurante', async () => {
            const platos = await request(app).get(`/api/v1/restaurants/${seed.restaurantB}/dishes`).set('Authorization', admin)
            expect(platos.status).toBe(200)
            const crea = await request(app).post(`/api/v1/restaurants/${seed.restaurantB}/ingredients`).set('Authorization', admin).send(ingredientBody)
            expect(crea.status).toBe(201)
            const ing = await request(app).get(`/api/v1/restaurants/${seed.restaurantA}/ingredients`).set('Authorization', admin)
            expect(ing.status).toBe(200)
        })
    })

    describe('IDOR: recurso de B usando la ruta de A', () => {
        it('admin y manager de A reciben 404 en PUT de un plato de B y no lo modifican', async () => {
            for (const token of [admin, managerA]) {
                const res = await request(app).put(`/api/v1/restaurants/${seed.restaurantA}/dishes/${seed.dishB}`).set('Authorization', token).send(dishUpdate)
                expect(res.status).toBe(404)
            }
            const plato = await request(app).get(`/api/v1/restaurants/${seed.restaurantB}/dishes/${seed.dishB}`).set('Authorization', admin)
            expect(plato.body.name).toBe('Plato de prueba')
        })

        it('admin y manager de A reciben 404 en DELETE de un plato de B y no lo borran', async () => {
            for (const token of [admin, managerA]) {
                const res = await request(app).delete(`/api/v1/restaurants/${seed.restaurantA}/dishes/${seed.dishB}`).set('Authorization', token)
                expect(res.status).toBe(404)
            }
            const plato = await request(app).get(`/api/v1/restaurants/${seed.restaurantB}/dishes/${seed.dishB}`).set('Authorization', admin)
            expect(plato.status).toBe(200)
        })

        it('GET de un plato o ingrediente de B por la ruta de A -> 404', async () => {
            const plato = await request(app).get(`/api/v1/restaurants/${seed.restaurantA}/dishes/${seed.dishB}`).set('Authorization', managerA)
            expect(plato.status).toBe(404)
            const ing = await request(app).get(`/api/v1/restaurants/${seed.restaurantA}/ingredients/${seed.ingredientB}`).set('Authorization', managerA)
            expect(ing.status).toBe(404)
        })

        it('admin recibe 404 en PUT y DELETE de un ingrediente de B por la ruta de A', async () => {
            const put = await request(app).put(`/api/v1/restaurants/${seed.restaurantA}/ingredients/${seed.ingredientB}`).set('Authorization', admin).send(ingredientBody)
            expect(put.status).toBe(404)
            const del = await request(app).delete(`/api/v1/restaurants/${seed.restaurantA}/ingredients/${seed.ingredientB}`).set('Authorization', admin)
            expect(del.status).toBe(404)
            const ing = await request(app).get(`/api/v1/restaurants/${seed.restaurantB}/ingredients/${seed.ingredientB}`).set('Authorization', admin)
            expect(ing.status).toBe(200)
        })
    })
})
