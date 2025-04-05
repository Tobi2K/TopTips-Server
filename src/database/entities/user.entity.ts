import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column()
  email: string;

  @Column()
  password: string;

  @Column({nullable: true})
  last_seen_version: string;
}
