import { describe, it, expect } from 'vitest'
import { normalizeDishCategory, validateDishIngredient } from './dish.model.js'

describe('normalizeDishCategory', () => {
    it('lanza un error en español con las categorías válidas', () => {
        expect(() => normalizeDishCategory('sopa')).toThrow('Categoría inválida: sopa. Debe ser una de: entrante, principal, postre, bebida')
    })
})

describe('validateDishIngredient', () => {
    it('exige el id del ingrediente', () => {
        expect(() => validateDishIngredient({ ingredientId: ' ', quantity: 1 })).toThrow('El ID del ingrediente es obligatorio')
    })

    it('exige una cantidad positiva', () => {
        expect(() => validateDishIngredient({ ingredientId: 'ing-1', quantity: 0 })).toThrow('La cantidad del ingrediente debe ser positiva')
    })
})
