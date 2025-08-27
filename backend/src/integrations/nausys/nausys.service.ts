// backend/src/integrations/nausys/nausys.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  NausysGetYachtsResponse,
  NausysLoginDto,
  NausysLoginResponse,
} from './nausys.dto';

@Injectable()
export class NausysService {
  private readonly logger = new Logger(NausysService.name);

  // Базовый URL берём из env, по умолчанию — публичный Agency v6
  private readonly apiUrl =
    process.env.NAUSYS_API_URL ?? 'https://api.nausys.com/v6/Agency';

  // Тестовые/боевые креды могут прийти из .env
  private readonly username = process.env.NAUSYS_USERNAME ?? '';
  private readonly password = process.env.NAUSYS_PASSWORD ?? '';

  constructor(private readonly http: HttpService) {}

  /** Логин → получаем JWT-токен */
  async login(dto?: NausysLoginDto): Promise<NausysLoginResponse> {
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

    const resp = await firstValueFrom(
      this.http.post<NausysLoginResponse>(`${this.apiUrl}/Login`, body, {
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const data = resp.data;
    if (!data?.Token) {
      throw new Error('Login response does not contain a Token');
    }

    this.logger.log(`✅ Login success (token: ${data.Token.slice(0, 8)}…)`);
    return data;
  }

  /** Пример запроса списка яхт (эндпоинт — по документации NauSYS) */
  async getYachts(token: string): Promise<NausysGetYachtsResponse> {
    const { data } = await firstValueFrom(
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
    return data;
  }
}
