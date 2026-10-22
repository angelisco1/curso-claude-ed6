import { describe, it, expect, vi } from 'vitest'
import type { Request, Response } from 'express'
import { IngredientController } from './ingredient.controller.js'
import type { IngredientService } from '@services/ingredient.service.js'

const ingredient = {
    id: 'd1', name: 'Tomate', unit: 'kg', currentStock: 1, restaurantId: 'A', createdAt: 'x', updatedAt: 'x'
}

function setup() {
    const service = {
        findById: vi.fn().mockResolvedValue(ingredient),
        update: vi.fn().mockResolvedValue(ingredient),
        delete: vi.fn().mockResolvedValue(undefined)
    }
    const controller = new IngredientController(service as unknown as IngredientService)
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() } as unknown as Response
    const next = vi.fn()
    return { service, controller, res, next }
}

describe('IngredientController (restaurantId de la ruta)', () => {
    it('getById pasa restaurantId e id al servicio', async () => {
        const { service, controller, res, next } = setup()
        await controller.getById({ params: { restaurantId: 'A', id: 'd1' } } as unknown as Request, res, next)
        expect(service.findById).toHaveBeenCalledWith('A', 'd1')
    })

    it('update pasa restaurantId e id al servicio', async () => {
        const { service, controller, res, next } = setup()
        const body = { name: 'n', unit: 'kg', currentStock: 1 }
        await controller.update({ params: { restaurantId: 'A', id: 'd1' }, body } as unknown as Request, res, next)
        expect(service.update).toHaveBeenCalledWith('A', 'd1', expect.objectContaining({ name: 'n' }))
    })

    it('delete pasa restaurantId e id al servicio', async () => {
        const { service, controller, res, next } = setup()
        await controller.delete({ params: { restaurantId: 'A', id: 'd1' } } as unknown as Request, res, next)
        expect(service.delete).toHaveBeenCalledWith('A', 'd1')
    })
})
