import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
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

  @ManyToOne(() => Competition, { eager: true })
  @JoinColumn()
  competition: Competition;

  @Column({ type: 'tinyint', default: 0 })
  important: number;

  @Column()
  current: boolean;

  @Column({ type: 'int', default: 1 })
  current_gameday: number;
}
