import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class PatchNotes {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  version: string;

  @Column({ type: 'longtext' })
  changes: string;
}
