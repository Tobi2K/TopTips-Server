import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Game } from './game.entity';
import { User } from './user.entity';

@Entity()
export class Guess {
    @PrimaryGeneratedColumn()
    guess_id: number;

    @ManyToOne(type => Game, { eager: true })
    @JoinColumn({ name: "game_id" })
    game_id: number;

    @ManyToOne(type => User, { eager: true })
    @JoinColumn({ name: "user_id" })
    user_id: number;

    @Column({ type: 'int' })
    score_team1: number;

    @Column({ type: 'int' })
    score_team2: number;

    @Column({ type: 'int' })
    special_bet: number;
}