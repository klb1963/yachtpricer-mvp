// backend/src/integrations/nausys/nausys.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import axios from 'axios';

import { NausysLoginDto, NausysLoginResponse } from './nausys.dto';

@Injectable()
export class NausysService {
  private readonly logger = new Logger(NausysService.name);

  private readonly apiUrl: string =
    process.env.NAUSYS_API_URL ?? 'https://api.nausys.com/v6/Agency';

  private readonly username: string = process.env.NAUSYS_USERNAME ?? '';
  private readonly password: string = process.env.NAUSYS_PASSWORD ?? '';

  private readonly useMock: boolean =
    (process.env.NAUSYS_USE_MOCK ?? '').toLowerCase() === 'true';

  private token: string | null = null;
  private tokenExp?: Date;

  constructor(private readonly http: HttpService) {}

  /** Моковый логин (на случай если включен NAUSYS_USE_MOCK). */
  private mockLogin(): NausysLoginResponse {
    return {
      Token: 'mock-token-123',
      Expiration: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  }

  /** Реальный логин в NauSYS API */
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

    this.logger.log('🔐 Logging in to NauSYS API…');
    try {
      const res = await firstValueFrom(
        this.http.post<NausysLoginResponse>(`${this.apiUrl}/Login`, body, {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const token = res.data?.Token;
      const exp = res.data?.Expiration;
      if (!token) {
        throw new Error('Login response does not contain a Token');
      }
      this.token = token;
      this.tokenExp = exp ? new Date(exp) : undefined;
      this.logger.log('✅ NauSYS login success');
      return res.data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        this.logger.error(`Login failed: ${err.message}`);
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Login failed: ${msg}`);
      throw err instanceof Error ? err : new Error(msg);
    }
  }
}
