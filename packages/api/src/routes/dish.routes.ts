import { Router } from 'express'
import { DishController } from '@controllers/dish.controller.js'
import { dbConfig } from '@config/database.js'
import { SqliteDishRepository } from '@repositories/dish.repository.js'
import { DishService } from '@services/dish.service.js'
import { authenticate, authorize, authorizeRestaurant } from '@shared/infrastructure/http/middlewares.js'

const dishRepository = new SqliteDishRepository(dbConfig)
const dishService = new DishService(dishRepository)
const dishController = new DishController(dishService)

const router = Router({ mergeParams: true })

router.post('/', authenticate, authorize(['admin', 'manager']), authorizeRestaurant, dishController.create)
router.get('/', authenticate, authorize(['admin', 'manager', 'camarero', 'cocinero']), authorizeRestaurant, dishController.getAll)
router.get('/:id', authenticate, authorize(['admin', 'manager', 'camarero', 'cocinero']), authorizeRestaurant, dishController.getById)
router.put('/:id', authenticate, authorize(['admin', 'manager']), authorizeRestaurant, dishController.update)
router.delete('/:id', authenticate, authorize(['admin', 'manager']), authorizeRestaurant, dishController.delete)

export default router
