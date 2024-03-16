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

  @Post('/api/html2blocks')
  async html2blocks(
    @Body('html') html: string,
    @Body('source') source: string,
    @Body('to_block') toBlock: boolean,
  ) {
    const data = await this.appService.htmlToBlocks(html, source, toBlock);
    return { ok: true, data };
  }

  @Post('/api/converter-html2blocks')
  async converterHtmlToBlocks(
    @Body('html') html: string,
    @Body('to_block') toBlock: boolean,
  ) {
    const data = await this.appService.converterHtmlToBlocks(html, toBlock);
    return { ok: true, data };
  }
}
