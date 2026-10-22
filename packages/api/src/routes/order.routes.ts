import { Router } from 'express'
import { OrderController } from '@controllers/order.controller.js'
import { OrderService } from '@services/order.service.js'
import { SqliteOrderRepository } from '@repositories/order.repository.js'
import { SqliteTableRepository } from '@repositories/table.repository.js'
import { dbConfig } from '@config/database.js'
import { authenticate, authorize } from '@shared/infrastructure/http/middlewares.js'

const orderRepository = new SqliteOrderRepository(dbConfig)
const tableRepository = new SqliteTableRepository(dbConfig)
const orderService = new OrderService(orderRepository, tableRepository)
const orderController = new OrderController(orderService)

const router = Router()

const STAFF_ROLES = ['admin', 'manager', 'camarero', 'cocinero']

router.post('/', authenticate, authorize(['admin', 'manager', 'camarero', 'cliente']), orderController.createOrder.bind(orderController))
router.get('/active', authenticate, authorize(STAFF_ROLES), orderController.getActiveOrders.bind(orderController))
router.get('/mine', authenticate, orderController.getMyOrders.bind(orderController))
router.get('/:id', authenticate, orderController.getById.bind(orderController))
router.patch('/:orderId/items/:itemId/status', authenticate, authorize(STAFF_ROLES), orderController.updateItemStatus.bind(orderController))

export default router
