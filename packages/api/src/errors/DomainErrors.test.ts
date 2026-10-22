import { describe, it, expect } from 'vitest'
import * as DomainErrors from './DomainErrors.js'

const MENSAJES_ESPERADOS: Record<string, string> = {
    FirstNameRequiredError: 'El nombre es obligatorio',
    LastNameRequiredError: 'Los apellidos son obligatorios',
    PasswordHashRequiredError: 'El hash de la contraseña es obligatorio',
    InvalidRoleError: 'Rol inválido',
    InvalidEmailError: 'Formato de email inválido',
    InvalidCredentialsError: 'Credenciales inválidas',
    DuplicatedEmailError: 'El email ya está en uso',
    EmployeeNotFoundError: 'Empleado no encontrado',
    RestaurantNameRequiredError: 'El nombre del restaurante es obligatorio',
    RestaurantAddressRequiredError: 'La dirección del restaurante es obligatoria',
    RestaurantEmailRequiredError: 'El email del restaurante es obligatorio',
    RestaurantNotFoundError: 'Restaurante no encontrado',
    InvalidPhoneError: 'Formato de teléfono inválido',
    OwnerFirstNameRequiredError: 'El nombre del propietario es obligatorio',
    OwnerLastNameRequiredError: 'Los apellidos del propietario son obligatorios',
    IngredientNameRequiredError: 'El nombre del ingrediente es obligatorio',
    IngredientNotFoundError: 'Ingrediente no encontrado',
    InvalidUnitError: 'Unidad inválida',
    NegativeStockError: 'El stock no puede ser negativo',
    RestaurantIdRequiredError: 'El ID del restaurante es obligatorio',
    DishNameRequiredError: 'El nombre del plato es obligatorio',
    InvalidPriceError: 'El precio debe ser un número positivo',
    InvalidCategoryError: 'Categoría inválida',
    DishNotFoundError: 'Plato no encontrado',
    DatabaseNotInitializedError: 'La base de datos no está inicializada. Llama antes a dbConfig.initialize().',
    InvalidOrderStatusError: 'Estado de pedido inválido',
    OrderNotFoundError: 'Pedido no encontrado'
}

describe('DomainErrors', () => {
    it.each(Object.entries(MENSAJES_ESPERADOS))('%s tiene el mensaje por defecto en español', (nombre, mensaje) => {
        const ErrorClass = (DomainErrors as Record<string, new () => Error>)[nombre]
        expect(ErrorClass).toBeDefined()
        const error = new ErrorClass!()
        expect(error.message).toBe(mensaje)
        expect(error.name).toBe(nombre)
    })
})
