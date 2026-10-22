import { Router } from 'express'
import { TableController } from '@controllers/table.controller.js'
import { dbConfig } from '@config/database.js'
import { SqliteTableRepository } from '@repositories/table.repository.js'
import { TableService } from '@services/table.service.js'
import { authenticate, authorize, authorizeRestaurant } from '@shared/infrastructure/http/middlewares.js'

const tableRepository = new SqliteTableRepository(dbConfig)
const tableService = new TableService(tableRepository)
const tableController = new TableController(tableService)

const router = Router({ mergeParams: true })

const STAFF_ROLES = ['admin', 'manager', 'camarero', 'cocinero']
const STATUS_ROLES = ['admin', 'manager', 'camarero']

router.get('/', authenticate, authorize(STAFF_ROLES), authorizeRestaurant, tableController.getAll)
router.get('/:id', authenticate, authorize(STAFF_ROLES), authorizeRestaurant, tableController.getById)
router.post('/', authenticate, authorize(['admin']), authorizeRestaurant, tableController.create)
router.put('/:id', authenticate, authorize(['admin']), authorizeRestaurant, tableController.update)
router.delete('/:id', authenticate, authorize(['admin']), authorizeRestaurant, tableController.delete)
router.patch('/:id/status', authenticate, authorize(STATUS_ROLES), authorizeRestaurant, tableController.updateStatus)

export default router
