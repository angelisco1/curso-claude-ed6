import { TestBed } from '@angular/core/testing'
import { provideZonelessChangeDetection } from '@angular/core'
import { HttpErrorResponse } from '@angular/common/http'
import { of, Subject, throwError } from 'rxjs'
import { TableStore } from './table.store'
import { TableService } from '../services/table.service'
import type { Table } from '../models/table.model'

const makeTable = (id: string, number: number, overrides: Partial<Table> = {}): Table => ({
  id,
  number,
  description: null,
  capacity: 4,
  status: 'libre',
  occupiedBy: null,
  restaurantId: 'r1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides
})

const httpError = (status: number) => new HttpErrorResponse({ status, error: { error: 'Error' } })

describe('TableStore', () => {
  let store: TableStore
  let service: {
    getAll: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    service = { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: TableService, useValue: service }]
    })
    store = TestBed.inject(TableStore)
  })

  it('arranca vacío, sin carga y sin error', () => {
    expect(store.tables()).toEqual([])
    expect(store.loading()).toBe(false)
    expect(store.error()).toBeNull()
  })

  describe('loadByRestaurant', () => {
    it('marca loading mientras la petición está en curso y guarda las mesas', async () => {
      const response = new Subject<Table[]>()
      service.getAll.mockReturnValue(response)

      const promise = store.loadByRestaurant('r1')
      expect(service.getAll).toHaveBeenCalledWith('r1')
      expect(store.loading()).toBe(true)

      const tables = [makeTable('t1', 1), makeTable('t2', 2)]
      response.next(tables)
      response.complete()
      await promise

      expect(store.tables()).toEqual(tables)
      expect(store.loading()).toBe(false)
      expect(store.error()).toBeNull()
    })

    it('guarda el mensaje de error y apaga loading si la petición falla', async () => {
      service.getAll.mockReturnValue(throwError(() => httpError(500)))

      await store.loadByRestaurant('r1')

      expect(store.error()).toBe('No se pudieron cargar las mesas.')
      expect(store.loading()).toBe(false)
      expect(store.tables()).toEqual([])
    })

    it('limpia el error anterior al volver a cargar con éxito', async () => {
      service.getAll.mockReturnValueOnce(throwError(() => httpError(500)))
      await store.loadByRestaurant('r1')
      expect(store.error()).not.toBeNull()

      service.getAll.mockReturnValueOnce(of([makeTable('t1', 1)]))
      await store.loadByRestaurant('r1')

      expect(store.error()).toBeNull()
      expect(store.tables()).toHaveLength(1)
    })
  })

  describe('create', () => {
    it('añade la mesa creada al final de la lista', async () => {
      service.getAll.mockReturnValue(of([makeTable('t1', 1)]))
      await store.loadByRestaurant('r1')
      const created = makeTable('t2', 2)
      service.create.mockReturnValue(of(created))
      const dto = { number: 2, description: null, capacity: 4 }

      await store.create('r1', dto)

      expect(service.create).toHaveBeenCalledWith('r1', dto)
      expect(store.tables().map(t => t.id)).toEqual(['t1', 't2'])
    })

    it('propaga el error y no modifica la lista', async () => {
      service.getAll.mockReturnValue(of([makeTable('t1', 1)]))
      await store.loadByRestaurant('r1')
      const error = httpError(409)
      service.create.mockReturnValue(throwError(() => error))

      await expect(store.create('r1', { number: 1, description: null, capacity: 4 })).rejects.toBe(error)
      expect(store.tables().map(t => t.id)).toEqual(['t1'])
    })
  })

  describe('update', () => {
    it('sustituye solo la mesa actualizada', async () => {
      service.getAll.mockReturnValue(of([makeTable('t1', 1), makeTable('t2', 2)]))
      await store.loadByRestaurant('r1')
      const updated = makeTable('t2', 7, { status: 'reservada' })
      service.update.mockReturnValue(of(updated))
      const dto = { number: 7, description: null, capacity: 4, status: 'reservada' as const }

      await store.update('r1', 't2', dto)

      expect(service.update).toHaveBeenCalledWith('r1', 't2', dto)
      expect(store.tables()).toEqual([makeTable('t1', 1), updated])
    })

    it('propaga el error y no modifica la lista', async () => {
      const tables = [makeTable('t1', 1)]
      service.getAll.mockReturnValue(of(tables))
      await store.loadByRestaurant('r1')
      service.update.mockReturnValue(throwError(() => httpError(400)))

      await expect(store.update('r1', 't1', { number: 0, description: null, capacity: 4 })).rejects.toBeInstanceOf(HttpErrorResponse)
      expect(store.tables()).toEqual(tables)
    })
  })

  describe('delete', () => {
    it('quita la mesa eliminada de la lista', async () => {
      service.getAll.mockReturnValue(of([makeTable('t1', 1), makeTable('t2', 2)]))
      await store.loadByRestaurant('r1')
      service.delete.mockReturnValue(of(null))

      await store.delete('r1', 't1')

      expect(service.delete).toHaveBeenCalledWith('r1', 't1')
      expect(store.tables().map(t => t.id)).toEqual(['t2'])
    })

    it('propaga el error y mantiene la mesa en la lista', async () => {
      service.getAll.mockReturnValue(of([makeTable('t1', 1)]))
      await store.loadByRestaurant('r1')
      service.delete.mockReturnValue(throwError(() => httpError(409)))

      await expect(store.delete('r1', 't1')).rejects.toBeInstanceOf(HttpErrorResponse)
      expect(store.tables().map(t => t.id)).toEqual(['t1'])
    })
  })
})
