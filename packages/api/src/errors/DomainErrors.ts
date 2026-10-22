import { AppError } from '@errors/AppError.js'

export class FirstNameRequiredError extends AppError {
  constructor() {
    super('El nombre es obligatorio')
  }
}

export class LastNameRequiredError extends AppError {
  constructor() {
    super('Los apellidos son obligatorios')
  }
}

export class PasswordHashRequiredError extends AppError {
  constructor() {
    super('El hash de la contraseña es obligatorio')
  }
}

export class InvalidRoleError extends AppError {
  constructor(message?: string) {
    super(message ?? 'Rol inválido')
  }
}

export class InvalidEmailError extends AppError {
  constructor() {
    super('Formato de email inválido')
  }
}

export class InvalidCredentialsError extends AppError {
  constructor() {
    super('Credenciales inválidas')
  }
}

export class DuplicatedEmailError extends AppError {
  constructor() {
    super('El email ya está en uso')
  }
}

export class EmployeeNotFoundError extends AppError {
  constructor() {
    super('Empleado no encontrado')
  }
}

export class RestaurantNameRequiredError extends AppError {
  constructor() {
    super('El nombre del restaurante es obligatorio')
  }
}

export class RestaurantAddressRequiredError extends AppError {
  constructor() {
    super('La dirección del restaurante es obligatoria')
  }
}

export class RestaurantEmailRequiredError extends AppError {
  constructor() {
    super('El email del restaurante es obligatorio')
  }
}

export class RestaurantNotFoundError extends AppError {
  constructor() {
    super('Restaurante no encontrado')
  }
}

export class InvalidPhoneError extends AppError {
  constructor() {
    super('Formato de teléfono inválido')
  }
}

export class OwnerFirstNameRequiredError extends AppError {
  constructor() {
    super('El nombre del propietario es obligatorio')
  }
}

export class OwnerLastNameRequiredError extends AppError {
  constructor() {
    super('Los apellidos del propietario son obligatorios')
  }
}

export class IngredientNameRequiredError extends AppError {
  constructor() {
    super('El nombre del ingrediente es obligatorio')
  }
}

export class IngredientNotFoundError extends AppError {
  constructor() {
    super('Ingrediente no encontrado')
  }
}

export class InvalidUnitError extends AppError {
  constructor(message?: string) {
    super(message ?? 'Unidad inválida')
  }
}

export class NegativeStockError extends AppError {
  constructor() {
    super('El stock no puede ser negativo')
  }
}

export class RestaurantIdRequiredError extends AppError {
  constructor() {
    super('El ID del restaurante es obligatorio')
  }
}

export class DishNameRequiredError extends AppError {
  constructor() {
    super('El nombre del plato es obligatorio')
  }
}

export class InvalidPriceError extends AppError {
  constructor() {
    super('El precio debe ser un número positivo')
  }
}

export class InvalidCategoryError extends AppError {
  constructor(message?: string) {
    super(message ?? 'Categoría inválida')
  }
}

export class DishNotFoundError extends AppError {
  constructor() {
    super('Plato no encontrado')
  }
}

export class DatabaseNotInitializedError extends AppError {
  constructor() {
    super('La base de datos no está inicializada. Llama antes a dbConfig.initialize().')
  }
}

export class InvalidOrderStatusError extends AppError {
  constructor(message?: string) {
    super(message ?? 'Estado de pedido inválido')
  }
}

export class OrderNotFoundError extends AppError {
  constructor() {
    super('Pedido no encontrado')
  }
}


export class InvalidTableStatusError extends AppError {
  constructor(message?: string) {
    super(message ?? 'Estado de mesa inválido')
  }
}
