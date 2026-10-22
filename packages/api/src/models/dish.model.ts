import { InvalidCategoryError } from '@errors/DomainErrors.js'

const VALID_DISH_CATEGORIES = ['entrante', 'principal', 'postre', 'bebida'] as const

export type DishCategoryType = typeof VALID_DISH_CATEGORIES[number]

export interface DishIngredient {
    ingredientId: string
    quantity: number
}

export interface Dish {
    id: string
    name: string
    description: string | null
    price: number
    category: DishCategoryType
    available: boolean
    restaurantId: string
    ingredients: DishIngredient[]
    createdAt: string
    updatedAt: string
}

export function normalizeDishCategory(value: string): DishCategoryType {
    const normalized = value.toLowerCase().trim()
    if (!VALID_DISH_CATEGORIES.includes(normalized as DishCategoryType)) {
        throw new InvalidCategoryError(`Categoría inválida: ${value}. Debe ser una de: ${VALID_DISH_CATEGORIES.join(', ')}`)
    }
    return normalized as DishCategoryType
}

export function validateDishIngredient(props: DishIngredient): DishIngredient {
    if (!props.ingredientId || props.ingredientId.trim() === '') {
        throw new Error('El ID del ingrediente es obligatorio')
    }
    if (props.quantity <= 0) {
        throw new Error('La cantidad del ingrediente debe ser positiva')
    }
    return { ingredientId: props.ingredientId, quantity: props.quantity }
}
