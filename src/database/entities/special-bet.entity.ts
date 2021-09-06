import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class SpecialBet {
  @PrimaryGeneratedColumn()
  bet_id: number;

  @Column()
  bet_desc: string;
}