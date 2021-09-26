import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Section } from 'src/database/entities/section.entity';
import { SectionController } from './section.controller';
import { SectionService } from './section.service';

@Module({
  imports: [TypeOrmModule.forFeature([Section])],
  providers: [SectionService],
  controllers: [SectionController],
})
export class SectionModule {}
