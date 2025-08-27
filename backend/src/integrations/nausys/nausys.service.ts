// backend/src/integrations/nausys/nausys.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class NausysService {
  private readonly logger = new Logger(NausysService.name);
  private readonly baseUrl = process.env.NAUSYS_API_URL ?? 'https://test-api.nausys.com/v6';
  private readonly username = process.env.NAUSYS_USERNAME ?? '';
  private readonly password = process.env.NAUSYS_PASSWORD ?? '';

  constructor(private readonly http: HttpService) {}

  async login(): Promise<any> {
    this.logger.log(`Logging in to NauSYS: ${this.username}`);
    const res = await firstValueFrom(
      this.http.post(`${this.baseUrl}/login`, {
        username: this.username,
        password: this.password,
      }),
    );
    return res.data;
  }

  async getYachts(token: string): Promise<any> {
    this.logger.log(`Fetching yachts from NauSYS`);
    const res = await firstValueFrom(
      this.http.get(`${this.baseUrl}/yachts`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    return res.data;
  }
}