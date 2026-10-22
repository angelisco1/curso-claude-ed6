import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Table, UpdateTableStatusDto } from '../models/table.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TableService {
  private readonly http = inject(HttpClient);

  private baseUrl(restaurantId: string): string {
    return `${environment.apiUrl}/restaurants/${restaurantId}/tables`;
  }

  getAll(restaurantId: string): Observable<Table[]> {
    return this.http.get<Table[]>(this.baseUrl(restaurantId));
  }

  updateStatus(restaurantId: string, id: string, dto: UpdateTableStatusDto): Observable<Table> {
    return this.http.patch<Table>(`${this.baseUrl(restaurantId)}/${id}/status`, dto);
  }
}
