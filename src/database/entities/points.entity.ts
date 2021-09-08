import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Game } from './game.entity';

@Entity()
export class Points {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Game, { eager: true })
    @JoinColumn({ name: "game_id" })
    game_id: number;

    @Column({ type: 'int' })
    points_player1: number;

    @Column({ type: 'int' })
    points_player2: number;

    @Column({ type: 'int' })
    points_player3: number;
}