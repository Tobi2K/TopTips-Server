import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { User } from 'src/database/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { Connection } from 'typeorm';
import { RegisterDto } from 'src/dtos/register.dto';
import { ChangeNameDto } from 'src/dtos/change-name.dto';
import { ChangeEmailDto } from 'src/dtos/change-email.dto';

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
      const x = this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET,
      });
      return {
        access_token: x,
        name: db.name,
        email: db.email,
      };
    } else {
      throw new HttpException(
        'Incorrect username or password.',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async register(user: RegisterDto) {
    const db_name = await this.usersService.findOne(user.name);

    const db_email = await this.connection.getRepository(User).findOne({
      where: {
        email: user.email,
      },
    });

    if (db_name) {
      throw new HttpException(
        'A user with that name exists!',
        HttpStatus.NOT_FOUND,
      );
    } else if (db_email) {
      throw new HttpException(
        'A user with that email exists!',
        HttpStatus.NOT_FOUND,
      );
    } else {
      bcrypt.hash(user.password, 10, (_err, hash) => {
        const x = new User();
        x.name = user.name;
        x.email = user.email;
        x.password = hash;
        this.usersService.addUser(x);
      });

      const payload = { name: user.name };
      return {
        access_token: this.jwtService.sign(payload, {
          secret: process.env.JWT_SECRET,
        }),
      };
    }
  }

  async changeEmail(email: ChangeEmailDto, user) {
    const db_name = await this.usersService.findOne(user.username);

    const db_email = await this.connection.getRepository(User).findOne({
      where: {
        email: email.email,
      },
    });

    if (!db_name) {
      throw new HttpException('User not found!', HttpStatus.NOT_FOUND);
    } else if (db_email) {
      throw new HttpException(
        'A user with that email exists!',
        HttpStatus.NOT_FOUND,
      );
    } else {
      this.connection.getRepository(User).update(db_name, {
        email: email.email,
      });
    }
  }

  // WIP
  async checkJWT(user) {
    console.log(user);
    const payload = { name: user.username };
    if (user.username) {
      const token = this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET,
      });
      return {
        access_token: token,
        name: user.username,
      };
    }
    return { name: user.username };
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
