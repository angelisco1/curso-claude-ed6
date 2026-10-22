import { Role } from '@employee/domain/value-objects/Role.js'
import { describe, it, expect } from 'vitest'

describe('Role Value Object', () => {
    it('should create a valid role', () => {
        const role = new Role('admin')
        expect(role.getValue()).toBe('admin')
    })

    it('should normalize role to lowercase', () => {
        const role = new Role('MANAGER')
        expect(role.getValue()).toBe('manager')
    })

    it('should throw InvalidRoleError for invalid role', () => {
        expect(() => new Role('invalid')).toThrow('Rol inválido: invalid. Debe ser uno de: admin, manager, camarero, cocinero, cliente')
    })

    it('should throw InvalidRoleError for empty role', () => {
        expect(() => new Role('')).toThrow('El rol es obligatorio')
    })

    it('should accept all valid roles', () => {
        const validRoles = ['admin', 'manager', 'camarero', 'cocinero', 'cliente']
        for (const r of validRoles) {
            const role = new Role(r)
            expect(role.getValue()).toBe(r)
        }
    })
})
