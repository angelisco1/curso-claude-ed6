import { InvalidRoleError } from '@errors/DomainErrors.js'

export type EmployeeRoleType = 'admin' | 'manager' | 'camarero' | 'cocinero' | 'cliente'

export const VALID_ROLES: readonly string[] = ['admin', 'manager', 'camarero', 'cocinero', 'cliente']

export class Role {
    private readonly value: EmployeeRoleType

    constructor(value: string) {
        if (!value || typeof value !== 'string') {
            throw new InvalidRoleError('El rol es obligatorio')
        }

        const normalizedValue = value.trim().toLowerCase()
        if (!VALID_ROLES.includes(normalizedValue)) {
            throw new InvalidRoleError(`Rol inválido: ${value}. Debe ser uno de: ${VALID_ROLES.join(', ')}`)
        }
        this.value = normalizedValue as EmployeeRoleType
    }

    public getValue(): EmployeeRoleType {
        return this.value
    }
}
