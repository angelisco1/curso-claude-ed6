import { Component, inject, OnInit, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { LucideAngularModule } from 'lucide-angular'
import { firstValueFrom } from 'rxjs'
import { TableStore } from '../../store/table.store'
import { TableService } from '../../services/table.service'
import { TABLE_STATUSES } from '../../models/table.model'
import type { CreateTableDto, TableStatus } from '../../models/table.model'

@Component({
  selector: 'app-table-form',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './table-form.component.html',
  styleUrl: './table-form.component.css'
})
export class TableFormComponent implements OnInit {
  private readonly store = inject(TableStore)
  private readonly service = inject(TableService)
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)

  isEditing = false
  tableId: string | null = null
  restaurantId: string = ''
  originalStatus: TableStatus | null = null
  loading = signal(false)
  error = signal<string | null>(null)

  statuses = TABLE_STATUSES

  form: CreateTableDto = {
    number: 1,
    description: null,
    capacity: 2,
    status: 'libre'
  }

  get pageTitle(): string {
    return this.isEditing ? 'Editar mesa' : 'Nueva mesa'
  }

  get listUrl(): string {
    return `/restaurants/${this.restaurantId}/tables`
  }

  ngOnInit(): void {
    this.restaurantId = this.route.parent?.snapshot.params['restaurantId'] ?? ''
    const id = this.route.snapshot.paramMap.get('id')

    if (id && this.restaurantId) {
      this.isEditing = true
      this.tableId = id
      this.loadTable()
    }
  }

  private async loadTable(): Promise<void> {
    this.loading.set(true)
    try {
      const table = await firstValueFrom(this.service.getById(this.restaurantId, this.tableId!))
      this.originalStatus = table.status
      this.form = {
        number: table.number,
        description: table.description,
        capacity: table.capacity,
        status: table.status
      }
    } catch {
      this.error.set('No se pudo cargar la mesa.')
    } finally {
      this.loading.set(false)
    }
  }

  async onSubmit(): Promise<void> {
    this.error.set(null)

    const validationError = this.validate()
    if (validationError) {
      this.error.set(validationError)
      return
    }

    if (this.isEditing && this.originalStatus === 'ocupada' && this.form.status !== 'ocupada') {
      const confirmed = confirm('Esta mesa está ocupada. Si cambias su estado, se soltará al cliente que la ocupa. ¿Continuar?')
      if (!confirmed) return
    }

    this.loading.set(true)
    try {
      const dto = { ...this.form, description: this.form.description?.trim() || null }
      if (this.isEditing && this.tableId) {
        await this.store.update(this.restaurantId, this.tableId, dto)
      } else {
        await this.store.create(this.restaurantId, dto)
      }
      this.router.navigate(['/restaurants', this.restaurantId, 'tables'])
    } catch (err: any) {
      this.error.set(err?.error?.message ?? err?.error?.error ?? 'Error al guardar la mesa.')
    } finally {
      this.loading.set(false)
    }
  }

  private validate(): string | null {
    if (!Number.isInteger(this.form.number) || this.form.number < 1) {
      return 'El número de mesa debe ser un entero mayor que 0.'
    }
    if (!Number.isInteger(this.form.capacity) || this.form.capacity < 1) {
      return 'La capacidad debe ser un entero mayor que 0.'
    }
    return null
  }
}
