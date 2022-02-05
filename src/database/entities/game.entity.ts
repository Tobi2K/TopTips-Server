import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { Season } from './season.entity';
import { SpecialBet } from './special-bet.entity';
import { Team } from './team.entity';

@Entity()
export class Game {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  event_id: string;

  @Column({ type: 'int' })
  spieltag: number;

  @Column({ type: 'varchar', nullable: true })
  stage: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  date: Date;

  @ManyToOne(() => Team, { eager: true })
  @JoinColumn()
  team1: Team;

  @ManyToOne(() => Team, { eager: true })
  @JoinColumn()
  team2: Team;

  @ManyToOne(() => SpecialBet, { eager: true })
  @JoinColumn()
  special_bet: SpecialBet;

  @Column({ type: 'int', default: 0 })
  score_team1: number;

  @Column({ type: 'int', default: 0 })
  score_team2: number;

  @Column({ type: 'int', default: 0 })
  special_bet_result: number;

  @Column({ type: 'tinyint', default: 0 })
  completed: number;

  @ManyToOne(() => Season, { eager: true })
  @JoinColumn()
  season: Season;
}
