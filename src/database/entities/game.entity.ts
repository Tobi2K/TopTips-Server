import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Team } from './team.entity';
import { SpecialBet } from './special-bet.entity';

@Entity()
export class Game {
    @PrimaryGeneratedColumn()
    game_id: number;

    @Column({ type: 'int' })
    spieltag: number;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    date: Date;

    //@ManyToOne(() => Team, { eager: true })
    //@JoinColumn({ name: "team1_id" })
    @Column({ type: 'int' })
    team1_id: number;

    //@ManyToOne(() => Team, { eager: true })
    //@JoinColumn({ name: "team2_id" })
    @Column({ type: 'int' })
    team2_id: number;

    //@ManyToOne(() => SpecialBet, { eager: true })
    //@JoinColumn({ name: "special_bet_id" })
    @Column({ type: 'int' })
    special_bet_id: number;

    @Column({ type: 'int', default: 0 })
    score_team1: number;

    @Column({ type: 'int', default: 0 })
    score_team2: number;

    @Column({ type: 'int', default: 0 })
    special_bet: number;
}