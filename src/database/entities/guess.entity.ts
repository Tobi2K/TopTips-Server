import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Game } from './game.entity';
import { Group } from './group.entity';
import { User } from './user.entity';

@Entity()
export class Guess {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Game, { eager: true })
  @JoinColumn()
  game: Game;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn()
  user: User;

  @Column({ type: 'int' })
  score_team1: number;

  @Column({ type: 'int' })
  score_team2: number;

  @ManyToOne(() => Group, { eager: true })
  @JoinColumn()
  group: Group;
}
