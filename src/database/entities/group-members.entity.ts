import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Group } from './group.entity';
import { User } from './user.entity';

@Entity()
export class GroupMembers {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Group, { eager: true })
  @JoinColumn()
  group: Group;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn()
  user: User;
}
