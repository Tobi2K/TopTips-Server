import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/database/entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findOne(name: string): Promise<User | undefined> {
    return this.userRepository.findOne({
      where: {
        name: name,
      },
    });
  }

  addUser(x: User) {
    this.userRepository.save(x);
  }

  deleteUser(db_user: User) {
    this.userRepository.delete(db_user);
  }
}
