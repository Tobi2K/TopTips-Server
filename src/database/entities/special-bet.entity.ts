import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class SpecialBet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  bet_desc: string;
}
