import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Team {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  competitor_id: string;

  @Column()
  name: string;

  @Column()
  abbreviation: string;

  @Column({ default: '#FFFFFF' })
  background_color: string;

  @Column({ default: '#000000' })
  text_color: string;
}
