import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { Season } from './season.entity';
import { User } from './user.entity';

@Entity()
export class EmailNotify {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn()
  user: User;

  @ManyToOne(() => Season, { eager: true })
  @JoinColumn()
  season: Season;

  @Column({ default: false })
  day_of: boolean;

  @Column({ default: false })
  day_before: boolean;
}
