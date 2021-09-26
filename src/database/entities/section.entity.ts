import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Section {
  @PrimaryGeneratedColumn()
  section_id: number;

  @Column({ type: 'timestamp' })
  starting_date: Date;
}
