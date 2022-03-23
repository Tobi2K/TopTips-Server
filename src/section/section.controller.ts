import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { SetSectionDto } from 'src/dtos/set-section.dto';
import { SectionService } from './section.service';

@Controller('section')
@ApiBearerAuth('access-token')
export class SectionController {
  constructor(private readonly sectionService: SectionService) {}

  @Get('all')
  getSections() {
    return this.sectionService.getSections();
  }

  @Get('current')
  getCurrentSection() {
    return this.sectionService.getCurrentSection();
  }

  @Post(':section')
  setDate(@Param('section') section: number, @Body() body: SetSectionDto) {
    return this.sectionService.setDate(section, body);
  }
}
