import { describe, it, expect, vi } from 'vitest'
import type { Request, Response } from 'express'
import { DishController } from './dish.controller.js'
import type { DishService } from '@services/dish.service.js'

const dish = {
    id: 'd1', name: 'Paella', description: null, price: 12, category: 'principal',
    available: true, restaurantId: 'A', ingredients: [], createdAt: 'x', updatedAt: 'x'
}

function setup() {
    const service = {
        findById: vi.fn().mockResolvedValue(dish),
        update: vi.fn().mockResolvedValue(dish),
        delete: vi.fn().mockResolvedValue(undefined)
    }
    const controller = new DishController(service as unknown as DishService)
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() } as unknown as Response
    const next = vi.fn()
    return { service, controller, res, next }
}

describe('DishController (restaurantId de la ruta)', () => {
    it('getById pasa restaurantId e id al servicio', async () => {
        const { service, controller, res, next } = setup()
        await controller.getById({ params: { restaurantId: 'A', id: 'd1' } } as unknown as Request, res, next)
        expect(service.findById).toHaveBeenCalledWith('A', 'd1')
    })

    it('update pasa restaurantId e id al servicio', async () => {
        const { service, controller, res, next } = setup()
        const body = { name: 'n', price: 1, category: 'principal', available: true }
        await controller.update({ params: { restaurantId: 'A', id: 'd1' }, body } as unknown as Request, res, next)
        expect(service.update).toHaveBeenCalledWith('A', 'd1', expect.objectContaining({ name: 'n' }))
    })

    it('delete pasa restaurantId e id al servicio', async () => {
        const { service, controller, res, next } = setup()
        await controller.delete({ params: { restaurantId: 'A', id: 'd1' } } as unknown as Request, res, next)
        expect(service.delete).toHaveBeenCalledWith('A', 'd1')
    })
})
