import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { User } from 'src/database/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { Connection } from 'typeorm';
import { RegisterDto } from 'src/dtos/register.dto';
import { ChangeNameDto } from 'src/dtos/change-name.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private connection: Connection,
  ) {}

  async validateUser(name: string, pass: string) {
    const user = await this.usersService.findOne(name);
    if (user) {
      if (bcrypt.compareSync(pass, user.password)) {
        const { password, ...result } = user;
        return result;
      } else return null;
    } else {
      throw new HttpException('User not found.', HttpStatus.NOT_FOUND);
    }
  }

  async login(user: any) {
    if (!user.name) {
      throw new HttpException(
        'It seems your app version is outdated. Please update.',
        HttpStatus.NOT_FOUND,
      );
    }
    const db = await this.validateUser(user.name, user.password);
    if (db) {
      const payload = { name: db.name };
      const x = this.jwtService.sign(payload);
      return {
        access_token: x,
        name: db.name,
      };
    } else {
      throw new HttpException(
        'Incorrect username or password.',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async register(user: RegisterDto) {
    const db = await this.usersService.findOne(user.name);

    if (db) {
      throw new HttpException(
        'A user with that name exists!',
        HttpStatus.NOT_FOUND,
      );
    } else {
      bcrypt.hash(user.password, 10, (_err, hash) => {
        const x = new User();
        x.name = user.name;
        x.password = hash;
        this.usersService.addUser(x);
      });

      const payload = { name: user.name };
      return {
        access_token: this.jwtService.sign(payload),
      };
    }
  }

  async getUserByJWT(token: string) {
    const decoded = await this.jwtService.verify(token);
    const db = await this.usersService.findOne(decoded.name);
    if (db) {
      return db;
    }
  }

  async updateUserByJWT(body: ChangeNameDto, user: { username: string }) {
    const dbuser = await this.usersService.findOne(user.username);

    if (dbuser.name == body.name) {
      throw new HttpException(
        'That is your username already.',
        HttpStatus.FORBIDDEN,
      );
    }

    const newUser = await this.usersService.findOne(body.name);

    if (newUser) {
      throw new HttpException(
        'A user with that username exists!',
        HttpStatus.FORBIDDEN,
      );
    } else {
      this.connection.getRepository(User).update(dbuser, {
        name: body.name,
      });
    }
  }
}
