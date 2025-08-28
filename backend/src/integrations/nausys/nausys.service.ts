// backend/src/integrations/nausys/nausys.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { AxiosError } from 'axios';

import {
  NausysGetYachtsResponse,
  NausysLoginDto,
  NausysLoginResponse,
  NausysYacht,
} from './nausys.dto';

// 👇 ДОБАВЛЕНО: Prisma типы (Decimal, InputJsonValue)
import { Prisma, YachtType } from '@prisma/client';
// 👇 ДОБАВЛЕНО: DI PrismaService
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NausysService {
  private readonly logger = new Logger(NausysService.name);

  private readonly apiUrl: string =
    process.env.NAUSYS_API_URL ?? 'https://api.nausys.com/v6/Agency';

  private readonly username: string = process.env.NAUSYS_USERNAME ?? '';
  private readonly password: string = process.env.NAUSYS_PASSWORD ?? '';

  // Включаем моки
  private readonly useMock: boolean =
    (process.env.NAUSYS_USE_MOCK ?? '').toLowerCase() === 'true' ||
    !this.apiUrl ||
    this.apiUrl.startsWith('http') === false;

  private token: string | null = null;
  private tokenExp?: Date;

  // 👇 ДОБАВЛЕНО: внедряем PrismaService через DI
  constructor(
    private readonly http: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  /** Мок-данные */
  private mockLogin(): NausysLoginResponse {
    return {
      Token: 'mock-token-123',
      Expiration: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  }

  private mockYachts(): NausysGetYachtsResponse {
    const yachts: NausysYacht[] = [
      {
        Id: 'Y1',
        Name: 'Mock Yacht One',
        Model: 'Bavaria 46',
        Manufacturer: 'Bavaria',
        Year: 2018,
        Cabins: 4,
        Berths: 8,
        Toilets: 2,
        Length: 14.0,
        Beam: 4.35,
        Draft: 2.1,
        BaseId: 'B1',
        BaseName: 'Split Marina',
        Currency: 'EUR',
        Price: 2500,
      },
      {
        Id: 'Y2',
        Name: 'Mock Yacht Two',
        Model: 'Oceanis 45',
        Manufacturer: 'Beneteau',
        Year: 2019,
        Cabins: 4,
        Berths: 10,
        Toilets: 3,
        Length: 13.5,
        Beam: 4.7,
        Draft: 2.2,
        BaseId: 'B2',
        BaseName: 'Athens Marina',
        Currency: 'EUR',
        Price: 2700,
      },
      {
        Id: 'Y3',
        Name: 'Mock Catamaran',
        Model: 'Lagoon 42',
        Manufacturer: 'Lagoon',
        Year: 2020,
        Cabins: 4,
        Berths: 12,
        Toilets: 4,
        Length: 12.8,
        Beam: 7.7,
        Draft: 1.25,
        BaseId: 'B3',
        BaseName: 'Lefkada Marina',
        Currency: 'EUR',
        Price: 4200,
      },
    ];
    return { Yachts: yachts };
  }

  /** Логин */
  async login(dto?: NausysLoginDto): Promise<NausysLoginResponse> {
    if (this.useMock) {
      this.logger.log('[MOCK] NauSYS login');
      const res = this.mockLogin();
      this.token = res.Token;
      this.tokenExp = new Date(res.Expiration);
      return res;
    }

    const body = {
      Username: dto?.username ?? this.username,
      Password: dto?.password ?? this.password,
    };
    if (!body.Username || !body.Password) {
      throw new Error(
        'Missing credentials: set NAUSYS_USERNAME/NAUSYS_PASSWORD or pass them in the body',
      );
    }

    this.logger.log('Logging in to NauSYS API…');

    const res = await firstValueFrom(
      this.http.post<NausysLoginResponse>(`${this.apiUrl}/Login`, body, {
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const token = res.data?.Token;
    const exp = res.data?.Expiration;
    if (!token) throw new Error('Login response does not contain a Token');

    this.token = token;
    this.tokenExp = exp ? new Date(exp) : undefined;
    this.logger.log('✅ Login success');
    return res.data;
  }

  private isTokenValid(): boolean {
    return !!(this.token && this.tokenExp && this.tokenExp > new Date());
  }

  private async ensureToken(): Promise<string> {
    if (this.useMock) return 'mock-token-123';
    if (this.isTokenValid()) return this.token!;
    const { Token, Expiration } = await this.login();
    this.token = Token;
    this.tokenExp = Expiration ? new Date(Expiration) : undefined;
    return this.token; // 👈 non-null
  }

  private async authedPost<T>(path: string, body: unknown = {}): Promise<T> {
    if (this.useMock) {
      if (path === '/GetYachts') return this.mockYachts() as unknown as T;
      return {} as T;
    }

    const token = await this.ensureToken();
    try {
      const res = await firstValueFrom(
        this.http.post<T>(`${this.apiUrl}${path}`, body, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }),
      );
      return res.data;
    } catch (err) {
      const e = err as AxiosError;
      if (e.response?.status === 401) {
        this.logger.warn('Token expired, re-login…');
        const { Token: newToken } = await this.login();
        const res2 = await firstValueFrom(
          this.http.post<T>(`${this.apiUrl}${path}`, body, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${newToken}`,
            },
          }),
        );
        return res2.data;
      }
      throw e;
    }
  }

  /** Получить яхты (mock вернёт моки) */
  async getYachtsAuto(): Promise<NausysGetYachtsResponse> {
    return this.authedPost<NausysGetYachtsResponse>('/GetYachts', {});
  }

  /** Старый метод с явным токеном — в mock тоже возвращает моки */
  async getYachts(token: string): Promise<NausysGetYachtsResponse> {
    if (this.useMock) return this.mockYachts();
    const res = await firstValueFrom(
      this.http.post<NausysGetYachtsResponse>(
        `${this.apiUrl}/GetYachts`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      ),
    );
    return res.data;
  }

  /** Синхронизация яхт в нашу таблицу Yacht */
  async syncYachts(): Promise<{ count: number }> {
    const resp = await this.getYachtsAuto();
    let count = 0;

    for (const y of resp.Yachts) {
      await this.prisma.yacht.upsert({
        where: { nausysId: y.Id }, // 👈 поле есть в схеме (String? @unique)
        create: {
          nausysId: y.Id,
          name: y.Name,
          manufacturer: y.Manufacturer ?? 'Unknown',
          model: y.Model ?? '',
          type: YachtType.monohull, // 👈 enum, вместо строки
          length: y.Length ?? 0,
          builtYear: y.Year ?? 0,
          cabins: y.Cabins ?? 0,
          heads: y.Toilets ?? 0,
          basePrice: new Prisma.Decimal(y.Price ?? 0),
          location: y.BaseName ?? '',
          fleet: 'NauSYS',
          charterCompany: '',
          currentExtraServices: {} as Prisma.InputJsonValue,
          imageUrl: null,
        },
        update: {
          name: y.Name,
          manufacturer: y.Manufacturer ?? 'Unknown',
          model: y.Model ?? '',
          type: YachtType.monohull, // 👈 enum, вместо строки
          length: y.Length ?? 0,
          builtYear: y.Year ?? 0,
          cabins: y.Cabins ?? 0,
          heads: y.Toilets ?? 0,
          basePrice: new Prisma.Decimal(y.Price ?? 0),
          location: y.BaseName ?? '',
          fleet: 'NauSYS',
          charterCompany: '',
          currentExtraServices: {} as Prisma.InputJsonValue,
          imageUrl: null,
        },
      });
      count++;
    }

    return { count };
  }
}
