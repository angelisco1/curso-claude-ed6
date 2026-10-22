import { Component, inject, OnInit, signal } from '@angular/core'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { LucideAngularModule } from 'lucide-angular'
import { TableStore } from '../../store/table.store'
import type { Table } from '../../models/table.model'

@Component({
  selector: 'app-table-list',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './table-list.component.html',
  styleUrl: './table-list.component.css'
})
export class TableListComponent implements OnInit {
  readonly store = inject(TableStore)
  private readonly route = inject(ActivatedRoute)
  restaurantId = ''
  deleteError = signal<string | null>(null)

  ngOnInit(): void {
    this.restaurantId = this.route.parent?.snapshot.params['restaurantId'] ?? ''
    if (this.restaurantId) {
      this.store.loadByRestaurant(this.restaurantId)
    }
  }

  statusClass(table: Table): string {
    return `badge badge-${table.status}`
  }

  async onDelete(table: Table): Promise<void> {
    if (!this.restaurantId) return
    if (!confirm(`¿Estás seguro de eliminar la mesa ${table.number}?`)) return

    this.deleteError.set(null)
    try {
      await this.store.delete(this.restaurantId, table.id)
    } catch (err: any) {
      this.deleteError.set(err?.error?.message ?? err?.error?.error ?? 'Error al eliminar la mesa.')
    }
  }
}
