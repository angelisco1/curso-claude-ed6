import { describe, it, expect } from 'vitest'
import { normalizeTableStatus } from './table.model.js'
import { InvalidTableStatusError } from '@errors/DomainErrors.js'

describe('normalizeTableStatus', () => {
    it.each(['libre', 'ocupada', 'reservada'])('acepta %s', (estado) => {
        expect(normalizeTableStatus(estado)).toBe(estado)
    })

    it('normaliza mayúsculas y espacios', () => {
        expect(normalizeTableStatus(' LIBRE ')).toBe('libre')
    })

    it('rechaza un estado desconocido con el mensaje en español', () => {
        expect(() => normalizeTableStatus('rota')).toThrow(InvalidTableStatusError)
        expect(() => normalizeTableStatus('rota')).toThrow('Estado inválido: rota. Debe ser uno de: libre, ocupada, reservada')
    })

    it('rechaza un valor que no es texto', () => {
        expect(() => normalizeTableStatus(undefined as unknown as string)).toThrow(InvalidTableStatusError)
    })
})
