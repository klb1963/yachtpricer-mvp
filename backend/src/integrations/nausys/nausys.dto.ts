// backend/src/integrations/nausys/nausys.dto.ts

import { IsString } from 'class-validator';

//
// ─────────────────────────────────────────────────────────────
// Agency API (Login, GetYachts)
// ─────────────────────────────────────────────────────────────
//

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

/** Ответ NauSYS на /GetYachts */
export interface NausysGetYachtsResponse {
  Yachts: NausysYacht[];
}

//
// ─────────────────────────────────────────────────────────────
// Catalogue API (Countries, Regions, Locations)
// ─────────────────────────────────────────────────────────────
//

/** Универсальный формат "имени" с переводами */
export interface MultiLangName {
  textEN?: string;
  textDE?: string;
  textHR?: string;
  textIT?: string;
  textSI?: string;
  // допускаем и другие ключи
  [k: string]: unknown;
}

/** Страна в NauSYS Catalogue */
export interface CountryDto {
  id: number;
  code?: string; // ISO alpha-2 или alpha-3
  code2?: string; // иногда дублируется
  name?: MultiLangName | string;
}

/** Регион в NauSYS Catalogue */
export interface RegionDto {
  id: number;
  countryId: number; // FK → CountryDto.id
  name?: MultiLangName | string;
}

/** Локация (марина/база) в NauSYS Catalogue */
export interface LocationDto {
  id: number;
  name?: MultiLangName | string;
  regionId?: number; // FK → RegionDto.id
  lon?: number; // долгота
  lat?: number; // широта
}

/** Ответы NauSYS Catalogue API */
export interface CountriesResponse {
  status: string;
  countries: CountryDto[];
}
export interface RegionsResponse {
  status: string;
  regions: RegionDto[];
}
export interface LocationsResponse {
  status: string;
  locations: LocationDto[];
}
