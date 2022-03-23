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
export class Points {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Game, { eager: true })
  @JoinColumn()
  game: Game;

  @Column({ type: 'int' })
  points: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn()
  user: User;

  @ManyToOne(() => Group, { eager: true })
  @JoinColumn()
  group: Group;
}
