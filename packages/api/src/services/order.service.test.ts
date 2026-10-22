import { describe, it, expect, beforeEach } from 'vitest'
import { OrderService, type OrderRequester } from './order.service.js'
import { MockOrderRepository } from '@repositories/mocks/MockOrderRepository.js'
import { MockTableRepository } from '@repositories/mocks/MockTableRepository.js'
import type { Order } from '@models/order.model.js'
import type { Table } from '@models/table.model.js'
import {
    OrderNotFoundError,
    InvalidOrderStatusError,
    TableNotFoundError,
    TableNotOccupiedError,
    TableNotAssignedError
} from '@errors/DomainErrors.js'

describe('OrderService.updateItemStatus', () => {
    let repo: MockOrderRepository
    let service: OrderService
    let testOrder: Order
    const camareroA: OrderRequester = { id: 'u-cam', role: 'camarero', restaurantId: 'rest-1' }
    const camareroB: OrderRequester = { id: 'u-camB', role: 'camarero', restaurantId: 'rest-2' }
    const admin: OrderRequester = { id: 'u-admin', role: 'admin', restaurantId: null }

    beforeEach(async () => {
        repo = new MockOrderRepository()
        service = new OrderService(repo, new MockTableRepository())

        testOrder = {
            id: 'order-1',
            restaurantId: 'rest-1',
            tableId: null,
            clientId: null,
            createdAt: new Date(),
            items: [
                { id: 'item-1', dishId: 'dish-1', quantity: 1, notes: null, status: 'pendiente' }
            ]
        }
        await repo.create(testOrder)
    })

    it('should update the status of an item successfully', async () => {
        await service.updateItemStatus('order-1', 'item-1', 'preparando', camareroA)
        const updatedItem = testOrder.items[0]!
        expect(updatedItem.status).toBe('preparando')
    })

    it('should throw an error if the order does not exist', async () => {
        await expect(service.updateItemStatus('order-bad', 'item-1', 'preparando', camareroA))
            .rejects.toThrow(OrderNotFoundError)
    })

    it('should throw an error if the item does not exist inside the order', async () => {
        await expect(service.updateItemStatus('order-1', 'item-bad', 'preparando', camareroA))
            .rejects.toThrow(OrderNotFoundError)
    })

    it('should throw DomainError if status is invalid', async () => {
        await expect(service.updateItemStatus('order-1', 'item-1', 'invalid-status', camareroA))
            .rejects.toThrow(InvalidOrderStatusError)
    })

    it('el admin puede actualizar items de cualquier restaurante', async () => {
        await service.updateItemStatus('order-1', 'item-1', 'listo', admin)
        expect(testOrder.items[0]!.status).toBe('listo')
    })

    it('un empleado de otro restaurante recibe OrderNotFoundError y no modifica el item', async () => {
        await expect(service.updateItemStatus('order-1', 'item-1', 'listo', camareroB))
            .rejects.toThrow(OrderNotFoundError)
        expect(testOrder.items[0]!.status).toBe('pendiente')
    })

    it('un cliente recibe OrderNotFoundError aunque sea el dueño del pedido', async () => {
        const cliente: OrderRequester = { id: 'cli-1', role: 'cliente', restaurantId: null }
        await expect(service.updateItemStatus('order-1', 'item-1', 'listo', cliente))
            .rejects.toThrow(OrderNotFoundError)
    })
})

describe('OrderService.getById (control de acceso)', () => {
    let service: OrderService

    const admin: OrderRequester = { id: 'u-admin', role: 'admin', restaurantId: null }
    const camareroA: OrderRequester = { id: 'u-cam', role: 'camarero', restaurantId: 'rest-1' }
    const camareroB: OrderRequester = { id: 'u-camB', role: 'camarero', restaurantId: 'rest-2' }
    const clienteDueno: OrderRequester = { id: 'cli-1', role: 'cliente', restaurantId: null }
    const clienteAjeno: OrderRequester = { id: 'cli-2', role: 'cliente', restaurantId: null }

    beforeEach(async () => {
        const repo = new MockOrderRepository()
        service = new OrderService(repo, new MockTableRepository())
        await repo.create({
            id: 'order-1',
            restaurantId: 'rest-1',
            tableId: null,
            clientId: 'cli-1',
            createdAt: new Date(),
            items: []
        })
    })

    it('el admin accede a cualquier pedido', async () => {
        expect((await service.getById('order-1', admin)).id).toBe('order-1')
    })

    it('un empleado accede a pedidos de su restaurante', async () => {
        expect((await service.getById('order-1', camareroA)).id).toBe('order-1')
    })

    it('un empleado de otro restaurante recibe OrderNotFoundError', async () => {
        await expect(service.getById('order-1', camareroB)).rejects.toThrow(OrderNotFoundError)
    })

    it('un cliente accede a su propio pedido', async () => {
        expect((await service.getById('order-1', clienteDueno)).id).toBe('order-1')
    })

    it('un cliente recibe OrderNotFoundError en un pedido ajeno', async () => {
        await expect(service.getById('order-1', clienteAjeno)).rejects.toThrow(OrderNotFoundError)
    })

    it('lanza OrderNotFoundError si el pedido no existe', async () => {
        await expect(service.getById('no-existe', admin)).rejects.toThrow(OrderNotFoundError)
    })
})

describe('OrderService.create (validación de la mesa)', () => {
    let orders: MockOrderRepository
    let tables: MockTableRepository
    let service: OrderService

    const cliente: OrderRequester = { id: 'cliente-1', role: 'cliente', restaurantId: null }
    const camarero: OrderRequester = { id: 'camarero-1', role: 'camarero', restaurantId: 'A' }
    const items = [{ dishId: 'd1', quantity: 2, notes: null }]

    const mesa = (props: Partial<Table> & Pick<Table, 'id'>): Table => ({
        number: 1,
        description: null,
        capacity: 4,
        status: 'libre',
        occupiedBy: null,
        restaurantId: 'A',
        createdAt: '2026-10-22T10:00:00.000Z',
        updatedAt: '2026-10-22T10:00:00.000Z',
        ...props
    })

    const pedido = (tableId: string | null, requester: OrderRequester) =>
        service.create({ restaurantId: 'A', tableId, clientId: requester.id, items }, requester)

    beforeEach(async () => {
        orders = new MockOrderRepository()
        tables = new MockTableRepository()
        service = new OrderService(orders, tables)
        await tables.save(mesa({ id: 'suya', number: 1, status: 'ocupada', occupiedBy: 'cliente-1' }))
        await tables.save(mesa({ id: 'ajena', number: 2, status: 'ocupada', occupiedBy: 'cliente-2' }))
        await tables.save(mesa({ id: 'staff', number: 3, status: 'ocupada', occupiedBy: null }))
        await tables.save(mesa({ id: 'libre', number: 4 }))
        await tables.save(mesa({ id: 'reservada', number: 5, status: 'reservada' }))
        await tables.save(mesa({ id: 'de-b', number: 1, status: 'ocupada', occupiedBy: 'cliente-1', restaurantId: 'B' }))
    })

    it('sin mesa crea el pedido como antes', async () => {
        const order = await pedido(null, camarero)
        expect(order.tableId).toBeNull()
        expect(order.items).toHaveLength(2)
        expect(orders.orders).toHaveLength(1)
    })

    it('un cliente pide con la mesa que ocupa', async () => {
        const order = await pedido('suya', cliente)
        expect(order.tableId).toBe('suya')
        expect(orders.orders).toHaveLength(1)
    })

    it('el staff pide con cualquier mesa ocupada del restaurante, la ocupe un cliente o no', async () => {
        await expect(pedido('ajena', camarero)).resolves.toMatchObject({ tableId: 'ajena' })
        await expect(pedido('staff', camarero)).resolves.toMatchObject({ tableId: 'staff' })
    })

    it.each(['no-existe', 'de-b', ''])('mesa %j inexistente o de otro restaurante -> TableNotFoundError', async (tableId) => {
        await expect(pedido(tableId, cliente)).rejects.toThrow(TableNotFoundError)
        expect(orders.orders).toHaveLength(0)
    })

    it.each(['libre', 'reservada'])('mesa %s -> TableNotOccupiedError (también para el staff)', async (tableId) => {
        await expect(pedido(tableId, cliente)).rejects.toThrow(TableNotOccupiedError)
        await expect(pedido(tableId, camarero)).rejects.toThrow('La mesa no está ocupada')
        expect(orders.orders).toHaveLength(0)
    })

    it.each(['ajena', 'staff'])('un cliente con la mesa %s -> TableNotAssignedError', async (tableId) => {
        await expect(pedido(tableId, cliente)).rejects.toThrow(TableNotAssignedError)
        expect(orders.orders).toHaveLength(0)
    })
})
