import { describe, it, expect, beforeEach } from 'vitest'
import { DishService } from './dish.service.js'
import { MockDishRepository } from '@repositories/mocks/MockDishRepository.js'
import { DishNotFoundError } from '@errors/DomainErrors.js'

describe('DishService (aislamiento por restaurante)', () => {
    let service: DishService
    let dishId: string

    const input = {
        name: 'Paella',
        description: null,
        price: 12,
        category: 'principal',
        available: true,
        restaurantId: 'A',
        ingredients: []
    }
    const updateInput = {
        name: 'Paella mixta',
        description: null,
        price: 14,
        category: 'principal',
        available: true,
        ingredients: []
    }

    beforeEach(async () => {
        service = new DishService(new MockDishRepository())
        dishId = (await service.create(input)).id
    })

    describe('findById', () => {
        it('devuelve el plato si es del restaurante', async () => {
            const dish = await service.findById('A', dishId)
            expect(dish.id).toBe(dishId)
        })

        it('lanza DishNotFoundError si es de otro restaurante', async () => {
            await expect(service.findById('B', dishId)).rejects.toThrow(DishNotFoundError)
        })

        it('lanza DishNotFoundError si no existe', async () => {
            await expect(service.findById('A', 'no-existe')).rejects.toThrow(DishNotFoundError)
        })
    })

    describe('update', () => {
        it('actualiza el plato del restaurante', async () => {
            const updated = await service.update('A', dishId, updateInput)
            expect(updated.name).toBe('Paella mixta')
        })

        it('lanza DishNotFoundError si es de otro restaurante y no lo modifica', async () => {
            await expect(service.update('B', dishId, updateInput)).rejects.toThrow(DishNotFoundError)
            expect((await service.findById('A', dishId)).name).toBe('Paella')
        })
    })

    describe('delete', () => {
        it('elimina el plato del restaurante', async () => {
            await service.delete('A', dishId)
            await expect(service.findById('A', dishId)).rejects.toThrow(DishNotFoundError)
        })

        it('lanza DishNotFoundError si es de otro restaurante y no lo elimina', async () => {
            await expect(service.delete('B', dishId)).rejects.toThrow(DishNotFoundError)
            expect((await service.findById('A', dishId)).id).toBe(dishId)
        })
    })
})

describe('DishService (mensajes de error en español)', () => {
    const service = new DishService(new MockDishRepository())
    const base = { name: 'Paella', description: null, price: 12, category: 'principal', available: true, restaurantId: 'A', ingredients: [] }

    it('nombre vacío', async () => {
        await expect(service.create({ ...base, name: ' ' })).rejects.toThrow('El nombre del plato es obligatorio')
    })

    it('precio no positivo', async () => {
        await expect(service.create({ ...base, price: 0 })).rejects.toThrow('El precio debe ser un número positivo')
    })

    it('categoría inválida', async () => {
        await expect(service.create({ ...base, category: 'sopa' })).rejects.toThrow('Categoría inválida: sopa')
    })

    it('plato inexistente', async () => {
        await expect(service.findById('A', 'no-existe')).rejects.toThrow('Plato no encontrado')
    })
})
