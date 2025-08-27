// backend/src/integrations/nausys/nausys.dto.ts

import { IsString } from 'class-validator';

export class NausysLoginDto {
  @IsString()
  username!: string;

  @IsString()
  password!: string;
}

/** Ответ NauSYS на /Login */
export interface NausysLoginResponse {
  Token: string;
  Expiration: string; // ISO datetime string
}

/** Ответ NauSYS на /GetYachts */
export interface NausysGetYachtsResponse {
  Yachts: NausysYacht[];
}

/** Модель яхты в NauSYS */
export interface NausysYacht {
  Id: string; // внутренний ID NauSYS
  Name: string; // название лодки
  Model: string;
  Manufacturer: string;
  Year: number;
  Cabins: number;
  Berths: number;
  Toilets: number;
  Length: number;
  Beam?: number;
  Draft?: number;
  BaseId?: string; // ID базы (марина)
  BaseName?: string; // Название марины
  Currency?: string;
  Price?: number;
  // 👆 это базовые поля; позже можно дополнять по документации NauSYS
}

export interface NausysGetYachtsResponse {
  Yachts: NausysYacht[];
}
