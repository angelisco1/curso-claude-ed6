import { Router } from 'express'
import { IngredientController } from '@controllers/ingredient.controller.js'
import { dbConfig } from '@config/database.js'
import { SqliteIngredientRepository } from '@repositories/ingredient.repository.js'
import { IngredientService } from '@services/ingredient.service.js'
import { authenticate, authorize, authorizeRestaurant } from '@shared/infrastructure/http/middlewares.js'

const ingredientRepository = new SqliteIngredientRepository(dbConfig)
const ingredientService = new IngredientService(ingredientRepository)
const ingredientController = new IngredientController(ingredientService)

const router = Router({ mergeParams: true })

router.post('/', authenticate, authorize(['admin']), authorizeRestaurant, ingredientController.create)
router.get('/', authenticate, authorize(['admin', 'manager', 'cocinero']), authorizeRestaurant, ingredientController.getAll)
router.get('/:id', authenticate, authorize(['admin', 'manager', 'cocinero']), authorizeRestaurant, ingredientController.getById)
router.put('/:id', authenticate, authorize(['admin']), authorizeRestaurant, ingredientController.update)
router.delete('/:id', authenticate, authorize(['admin']), authorizeRestaurant, ingredientController.delete)

export default router
