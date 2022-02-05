import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Competition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  competition_id: string;

  @Column()
  name: string;

  @Column({ default: 'N/A' })
  gender: string;
}
