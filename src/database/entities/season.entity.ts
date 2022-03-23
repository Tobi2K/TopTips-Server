import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Competition } from './competition.entity';

@Entity()
export class Season {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  season_id: string;

  @Column()
  name: string;

  @Column()
  start_date: Date;

  @Column()
  end_date: Date;

  @Column()
  year: string;

  @ManyToOne(() => Competition, { eager: true })
  @JoinColumn()
  competition: Competition;

  @Column({ type: 'tinyint', default: 0 })
  important: number;

  @Column({type: 'int', default: 1})
  current_gameday: number;
}
