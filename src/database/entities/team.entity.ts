import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';

@Entity()
export class Team {
  @PrimaryGeneratedColumn()
  team_id: number;

  @Column()
  competitor_id: string;

  @Column()
  name: string;
}