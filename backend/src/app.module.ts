import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { YachtsController } from './yachts.controller';

@Module({
  imports: [],
  controllers: [AppController, YachtsController],
  providers: [AppService],
})
export class AppModule {}
