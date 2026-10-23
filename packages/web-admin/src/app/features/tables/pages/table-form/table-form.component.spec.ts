import { TestBed } from '@angular/core/testing'
import { importProvidersFrom, provideZonelessChangeDetection } from '@angular/core'
import { provideHttpClient } from '@angular/common/http'
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing'
import { provideRouter, Router } from '@angular/router'
import { RouterTestingHarness } from '@angular/router/testing'
import { LucideAngularModule, Armchair, ChevronLeft, Edit, Plus, Trash2 } from 'lucide-angular'
import { TableFormComponent } from './table-form.component'
import { TABLE_ROUTES } from '../../tables.routes'
import type { Table } from '../../models/table.model'

const BASE = '/api/v1/restaurants/r1/tables'

const table: Table = {
  id: 't1',
  number: 3,
  description: 'Ventana',
  capacity: 4,
  status: 'libre',
  occupiedBy: null,
  restaurantId: 'r1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

describe('TableFormComponent', () => {
  let harness: RouterTestingHarness
  let http: HttpTestingController
  let el: HTMLElement

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'restaurants/:restaurantId', children: [{ path: 'tables', children: TABLE_ROUTES }] }
        ]),
        importProvidersFrom(LucideAngularModule.pick({ Armchair, ChevronLeft, Edit, Plus, Trash2 }))
      ]
    })
    http = TestBed.inject(HttpTestingController)
    harness = await RouterTestingHarness.create()
  })

  // Si un test falla con peticiones abiertas, verify() lanza: se resetea TestBed
  // igualmente para que el fallo no arrastre a los tests siguientes.
  afterEach(() => {
    vi.restoreAllMocks()
    try {
      http.verify()
    } finally {
      TestBed.resetTestingModule()
    }
  })

  // El componente y el store actualizan su estado tras awaits: se deja correr
  // esas continuaciones antes de esperar a que la vista se estabilice.
  const settle = async () => {
    await new Promise(resolve => setTimeout(resolve))
    await harness.fixture.whenStable()
  }

  const open = async (url: string) => {
    await harness.navigateByUrl(url, TableFormComponent)
    el = harness.routeNativeElement!
    await settle()
  }

  const input = (id: string) => el.querySelector<HTMLInputElement>(`#${id}`)!
  const select = () => el.querySelector<HTMLSelectElement>('#status')!
  const submitButton = () => el.querySelector<HTMLButtonElement>('button[type="submit"]')!
  const errorText = () => el.querySelector('.alert-error')?.textContent?.trim() ?? null

  const type = (id: string, value: string) => {
    const field = input(id)
    field.value = value
    field.dispatchEvent(new Event('input'))
  }

  const chooseStatus = (value: string) => {
    select().value = value
    select().dispatchEvent(new Event('change'))
  }

  const submit = async () => {
    submitButton().click()
    await settle()
  }

  // Tras guardar se navega a la lista, que vuelve a pedir las mesas.
  const expectNavigationToList = async () => {
    await settle()
    expect(TestBed.inject(Router).url).toBe('/restaurants/r1/tables')
    http.expectOne({ method: 'GET', url: BASE }).flush([])
    await settle()
  }

  describe('alta', () => {
    beforeEach(async () => open('/restaurants/r1/tables/new'))

    it('muestra el título y los valores por defecto', () => {
      expect(el.querySelector('h1')!.textContent).toContain('Nueva mesa')
      expect(input('number').value).toBe('1')
      expect(input('capacity').value).toBe('2')
      expect(input('description').value).toBe('')
      expect(select().value).toBe('libre')
      expect(Array.from(select().options).map(o => o.value)).toEqual(['libre', 'ocupada', 'reservada'])
      expect(el.querySelector('a.btn-secondary')!.getAttribute('href')).toBe('/restaurants/r1/tables')
    })

    it('crea la mesa con los datos del formulario y vuelve a la lista', async () => {
      type('number', '7')
      type('capacity', '6')
      type('description', '  Terraza  ')
      chooseStatus('reservada')
      await submit()

      const req = http.expectOne({ method: 'POST', url: BASE })
      expect(req.request.body).toEqual({ number: 7, capacity: 6, description: 'Terraza', status: 'reservada' })
      req.flush({ ...table, id: 't9', number: 7 })
      await expectNavigationToList()
    })

    it('envía la descripción como null si solo tiene espacios', async () => {
      type('description', '   ')
      await submit()

      const req = http.expectOne({ method: 'POST', url: BASE })
      expect(req.request.body.description).toBeNull()
      req.flush(table)
      await expectNavigationToList()
    })

    it('deshabilita el botón y muestra «Guardando...» mientras se guarda', async () => {
      await submit()

      expect(submitButton().disabled).toBe(true)
      expect(submitButton().textContent).toContain('Guardando...')

      http.expectOne({ method: 'POST', url: BASE }).flush(table)
      await expectNavigationToList()
    })

    it('no envía nada si el número no es un entero mayor que 0', async () => {
      type('number', '0')
      await submit()

      http.expectNone({ method: 'POST' })
      expect(errorText()).toBe('El número de mesa debe ser un entero mayor que 0.')
    })

    it('no envía nada si la capacidad no es un entero mayor que 0', async () => {
      type('capacity', '1.5')
      await submit()

      http.expectNone({ method: 'POST' })
      expect(errorText()).toBe('La capacidad debe ser un entero mayor que 0.')
    })

    it('muestra el mensaje de la API si falla el guardado y no navega', async () => {
      await submit()

      http.expectOne({ method: 'POST', url: BASE }).flush(
        { error: 'TableNumberAlreadyExistsError', message: 'Ya existe una mesa con ese número' },
        { status: 409, statusText: 'Conflict' }
      )
      await settle()

      expect(errorText()).toBe('Ya existe una mesa con ese número')
      expect(submitButton().disabled).toBe(false)
      expect(TestBed.inject(Router).url).toBe('/restaurants/r1/tables/new')
    })
  })

  describe('edición', () => {
    const openEdit = async (loaded: Table) => {
      await open('/restaurants/r1/tables/t1/edit')
      http.expectOne({ method: 'GET', url: `${BASE}/t1` }).flush(loaded)
      await settle()
    }

    it('carga la mesa y rellena el formulario', async () => {
      await openEdit(table)

      expect(el.querySelector('h1')!.textContent).toContain('Editar mesa')
      expect(input('number').value).toBe('3')
      expect(input('capacity').value).toBe('4')
      expect(input('description').value).toBe('Ventana')
      expect(select().value).toBe('libre')
    })

    it('muestra un error si no se puede cargar la mesa', async () => {
      await open('/restaurants/r1/tables/t1/edit')
      http.expectOne(`${BASE}/t1`).flush({ error: 'TableNotFoundError' }, { status: 404, statusText: 'Not Found' })
      await settle()

      expect(errorText()).toBe('No se pudo cargar la mesa.')
    })

    it('actualiza la mesa con PUT y vuelve a la lista', async () => {
      await openEdit(table)
      type('capacity', '8')
      type('description', '')
      await submit()

      const req = http.expectOne({ method: 'PUT', url: `${BASE}/t1` })
      expect(req.request.body).toEqual({ number: 3, capacity: 8, description: null, status: 'libre' })
      req.flush({ ...table, capacity: 8, description: null })
      await expectNavigationToList()
    })

    it('pide confirmación al liberar una mesa ocupada y no guarda si se cancela', async () => {
      await openEdit({ ...table, status: 'ocupada', occupiedBy: 'c1' })
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
      chooseStatus('libre')
      await submit()

      expect(confirmSpy).toHaveBeenCalledOnce()
      http.expectNone({ method: 'PUT' })
    })

    it('guarda el cambio de estado de una mesa ocupada si se confirma', async () => {
      await openEdit({ ...table, status: 'ocupada', occupiedBy: 'c1' })
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      chooseStatus('reservada')
      await submit()

      const req = http.expectOne({ method: 'PUT', url: `${BASE}/t1` })
      expect(req.request.body.status).toBe('reservada')
      req.flush({ ...table, status: 'reservada' })
      await expectNavigationToList()
    })

    it('no pide confirmación si la mesa ocupada sigue ocupada', async () => {
      await openEdit({ ...table, status: 'ocupada', occupiedBy: 'c1' })
      const confirmSpy = vi.spyOn(window, 'confirm')
      type('capacity', '5')
      await submit()

      expect(confirmSpy).not.toHaveBeenCalled()
      http.expectOne({ method: 'PUT', url: `${BASE}/t1` }).flush({ ...table, status: 'ocupada', capacity: 5 })
      await expectNavigationToList()
    })
  })
})
