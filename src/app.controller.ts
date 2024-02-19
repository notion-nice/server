import {
  Controller,
  UseInterceptors,
  UploadedFile,
  Body,
  Get,
  Post,
} from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('/api/converter')
  @UseInterceptors(FileInterceptor('file'))
  async converter(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    if (!file) {
      throw Error('File not found');
    }
    const directoryName = body.filename || uuid();
    return await this.appService.converter(file.path, directoryName);
  }
}
