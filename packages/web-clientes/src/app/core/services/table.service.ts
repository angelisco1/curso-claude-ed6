import { Injectable, inject } from '@angular/core'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Observable } from 'rxjs'
import { API_URL } from '@resttek/web-shared'
import { Table } from '../models/table.model'

@Injectable({ providedIn: 'root' })
export class TableService {
  private readonly http = inject(HttpClient)
  private readonly apiUrl = inject(API_URL)

  getAvailable(restaurantId: string, people: number): Observable<Table[]> {
    return this.http.get<Table[]>(
      `${this.apiUrl}/public/restaurants/${restaurantId}/tables/available`,
      { params: new HttpParams().set('people', people) }
    )
  }

  getMine(restaurantId: string): Observable<Table> {
    return this.http.get<Table>(`${this.apiUrl}/public/restaurants/${restaurantId}/tables/mine`)
  }

  occupy(restaurantId: string, tableId: string): Observable<Table> {
    return this.http.post<Table>(
      `${this.apiUrl}/public/restaurants/${restaurantId}/tables/${tableId}/occupy`,
      null
    )
  }
}
