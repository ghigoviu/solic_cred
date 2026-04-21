import { Controller, Post, Get, Body, Param, Query, Patch, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';
import { CreditRequestService } from './credit-request.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('requests')
@Controller('requests')
export class CreditRequestController {
  constructor(private readonly service: CreditRequestService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async create(@Body() dto: CreateRequestDto) {
    const requestId = await this.service.create(dto);
    return { requestId, status: 'VALIDATING' };
  }

  @Get()
  async findAll(@Query('country') country?: string) {
    return this.service.findAll(country);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const req = await this.service.findOne(id);
    if (!req) throw new NotFoundException('Request not found');
    return req;
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    const success = await this.service.updateStatus(id, status);
    if (!success) throw new NotFoundException('Request not found');
    return { id, status };
  }
}
