import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Section } from 'src/database/entities/section.entity';
import { SetSectionDto } from 'src/dtos/set-section.dto';
import { Repository } from 'typeorm';

@Injectable()
export class SectionService {
  private readonly logger = new Logger(SectionService.name);
  constructor(
    @InjectRepository(Section)
    private sectionRepository: Repository<Section>,
  ) {}

  async getCurrentSection() {
    const x = await this.sectionRepository.find({
      order: { id: 'ASC' },
    });
    if (x.length > 0) {
      for (let i = 0; i < x.length; i++) {
        const element = x[i].starting_date;
        const currentDate = new Date();
        if (
          element.getFullYear() == currentDate.getFullYear() &&
          element.getMonth() == currentDate.getMonth() &&
          element.getDate() == currentDate.getDate()
        ) {
          this.logger.debug('Today begins a new section.');
          return x[i].id;
        } else if (
          element.getFullYear() == currentDate.getFullYear() &&
          element.getMonth() == currentDate.getMonth() &&
          element.getDate() > currentDate.getDate()
        ) {
          this.logger.debug(
            'Considered section begins too late. Returning last section.',
          );
          return x[i - 1].id;
        } else if (
          element.getFullYear() == currentDate.getFullYear() &&
          element.getMonth() > currentDate.getMonth()
        ) {
          this.logger.debug(
            'Considered section begins too late. Returning last section.',
          );
          return x[i - 1].id;
        } else if (element.getFullYear() > currentDate.getFullYear()) {
          this.logger.debug(
            'Considered section begins too late. Returning last section.',
          );
          return x[i - 1].id;
        }
      }
      this.logger.debug('Selecting last set value');
      return x[x.length - 1].id;
    }
    this.logger.debug('Defaulting section to 1');
    return 1;
  }

  async setDate(section: number, body: SetSectionDto) {
    /*this.logger.debug(
      'Setting start date for section ' + id + ' to ' + body.date,
    );
    const existingGuess = await this.sectionRepository.findOne({
      where: { id: id },
    });
    if (existingGuess == undefined) {
      const section = new Section();
      section.id = id;
      section.starting_date = body.date;
      this.sectionRepository.save(section);
    } else {
      this.sectionRepository.update(
        {
          id: id,
        },
        {
          starting_date: body.date,
        },
      );
    }*/
  }

  async getSections() {
    return await this.sectionRepository.find();
  }
}
