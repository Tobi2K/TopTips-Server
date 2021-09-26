import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Game {
  @PrimaryGeneratedColumn()
  game_id: number;

  @Column({ type: 'varchar' })
  event_id: string;

  @Column({ type: 'int' })
  spieltag: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  date: Date;

  @Column({ type: 'int' })
  team1_id: number;

  @Column({ type: 'int' })
  team2_id: number;

  @Column({ type: 'int' })
  special_bet_id: number;

  @Column({ type: 'int', default: 0 })
  score_team1: number;

  @Column({ type: 'int', default: 0 })
  score_team2: number;

  @Column({ type: 'int', default: 0 })
  special_bet: number;

  @Column({ type: 'tinyint', default: 0 })
  completed: number;
}
