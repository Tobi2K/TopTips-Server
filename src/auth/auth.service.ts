import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { User } from 'src/database/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { config } from 'process';
import { jwtConstants } from './constants';
import { Connection } from 'typeorm';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private connection: Connection,
  ) {}

  async validateUser(email: string, pass: string) {
    const user = await this.usersService.findOne(email);
    if (user) {
      if (bcrypt.compareSync(pass, user.password)) {
        const { password, ...result } = user;
        return result;
      } else return null;
    } else return null;
  }

  async login(user: any) {
    const db = await this.validateUser(user.email, user.password);
    if (db) {
      const payload = { email: db.email, name: db.name };
      return {
        access_token: this.jwtService.sign(payload),
        name: db.name,
      };
    } else {
      throw new HttpException(
        'Incorrect username or password.',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async register(user: any) {
    const db = await this.usersService.findOne(user.email);

    if (db) {
      throw new HttpException(
        'A user with that email exists!',
        HttpStatus.NOT_FOUND,
      );
    } else {
      bcrypt.hash(user.password, 10, (_err, hash) => {
        const x = new User();
        x.email = user.email;
        x.name = user.username;
        x.password = hash;
        this.usersService.addUser(x);
      });

      const payload = { email: user.email, name: user.name };
      return {
        access_token: this.jwtService.sign(payload),
      };
    }
  }

  async getUserByJWT(token: string) {
    const decoded = await this.jwtService.verify(token);
    const db = await this.usersService.findOne(decoded.email);
    if (db) {
      return db;
    }
  }

  async updateUserByJWT(body: any, user: { email: string }) {
    const dbuser = await this.usersService.findOne(user.email);

    this.connection.getRepository(User).update(
      {
        id: dbuser.id,
      },
      {
        name: body.name,
      },
    );
  }
}
