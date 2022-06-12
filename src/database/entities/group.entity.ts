import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Season } from './season.entity';
import { User } from './user.entity';

@Entity()
@Unique(['passphrase'])
export class Group {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn()
  owner: User;

  @ManyToOne(() => Season, { eager: true })
  @JoinColumn()
  season: Season;

  @Column({ unique: true })
  passphrase: string;
}
