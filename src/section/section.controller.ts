import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SetSectionDto } from 'src/dtos/set-section.dto';
import { SectionService } from './section.service';

@Controller('section')
export class SectionController {
    constructor(
        private readonly sectionService: SectionService
    ) { }

    @Get('all')
    getSections() {
        return this.sectionService.getSections();
    }

    @Get('current')
    getCurrentSection() {
        return this.sectionService.getCurrentSection();
    }

    @Post(':id')
    setDate(@Param('id') id: number, @Body() body: SetSectionDto) {
        return this.sectionService.setDate(id, body);
    }
}
