import { describe, it, expect, vi } from 'vitest'
import type { Request, Response } from 'express'
import { OrderController } from './order.controller.js'
import type { OrderService } from '@services/order.service.js'
import { OrderNotFoundError } from '@errors/DomainErrors.js'

function setup() {
    const service = {
        listActive: vi.fn().mockResolvedValue([]),
        getById: vi.fn().mockResolvedValue({ id: 'o1' }),
        updateItemStatus: vi.fn().mockResolvedValue(undefined),
        create: vi.fn().mockResolvedValue({ id: 'o1' })
    }
    const controller = new OrderController(service as unknown as OrderService)
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() } as unknown as Response
    const next = vi.fn()
    return { service, controller, res, next }
}

const req = (extra: object) => extra as unknown as Request

describe('OrderController.getActiveOrders', () => {
    it('un empleado usa el restaurantId de su token e ignora el de la query', async () => {
        const { service, controller, res } = setup()
        await controller.getActiveOrders(
            req({ user: { id: 'u1', role: 'cocinero', restaurantId: 'A' }, query: { restaurantId: 'B' } }), res)
        expect(service.listActive).toHaveBeenCalledWith('A')
    })

    it('el admin usa el restaurantId de la query', async () => {
        const { service, controller, res } = setup()
        await controller.getActiveOrders(
            req({ user: { id: 'u1', role: 'admin', restaurantId: null }, query: { restaurantId: 'B' } }), res)
        expect(service.listActive).toHaveBeenCalledWith('B')
    })

    it('el admin sin restaurantId en la query recibe 400', async () => {
        const { service, controller, res } = setup()
        await controller.getActiveOrders(
            req({ user: { id: 'u1', role: 'admin', restaurantId: null }, query: {} }), res)
        expect(res.status).toHaveBeenCalledWith(400)
        expect(service.listActive).not.toHaveBeenCalled()
    })
})
