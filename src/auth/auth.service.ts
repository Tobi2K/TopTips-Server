import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { User } from 'src/database/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { Connection } from 'typeorm';
import { RegisterDto } from 'src/dtos/register.dto';
import { ChangeNameDto } from 'src/dtos/change-name.dto';
import { ChangeEmailDto } from 'src/dtos/change-email.dto';
import * as randtoken from 'rand-token';
import { ChangePasswordDto } from 'src/dtos/change-pass.dto';
import { Guess } from 'src/database/entities/guess.entity';
import { Points } from 'src/database/entities/points.entity';
import { Group } from 'src/database/entities/group.entity';
import { GroupMembers } from 'src/database/entities/group-members.entity';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private connection: Connection,
    private readonly mailerService: MailerService
  ) { }

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

  async forgotPassword(username: string) {
    this.logger.debug('Resetting password for ' + username);
    const db_user = await this.usersService.findOne(username);

    if (!db_user) {
      throw new HttpException('User not found!', HttpStatus.NOT_FOUND);
    }

    if (!db_user.email) {
      throw new HttpException(
        'No backup email set! Please contact me at admin@toptips.page.',
        HttpStatus.NOT_FOUND,
      );
    }
    const new_pass = randtoken.generate(10);
    bcrypt.hash(new_pass, 10, async (_err, hash) => {
      try {
        const sendMailParams = {
          to: username + "<" + db_user.email + ">",
          from: "TopTips <admin@toptips.page>",
          subject: 'TopTips - Password Reset',
          template: 'forgot-password',
          context: {
            name: username,
            password: new_pass,
          },
          attachments: [
            { filename: 'logo.png', path: __dirname + '/../templates/icon.png', cid: 'logo@toptips.page' },
          ]
        };
        await this.mailerService.sendMail(sendMailParams);

        this.logger.debug('Email sent');
        this.connection.getRepository(User).update(db_user, {
          password: hash,
        });
      } catch (error) {
        this.logger.error(error);
        throw new HttpException(
          'Unable to set your password',
          HttpStatus.FORBIDDEN,
        );
      }
    });
  }

  async changePassword(password: ChangePasswordDto, user) {
    this.logger.debug('Changing password for ' + user.username);
    const valid = await this.validateUser(user.username, password.oldPassword);

    if (!valid) {
      throw new HttpException(
        'Your password is invalid!',
        HttpStatus.FORBIDDEN,
      );
    }

    const db_user = await this.usersService.findOne(user.username);

    if (!db_user) {
      throw new HttpException('User not found!', HttpStatus.NOT_FOUND);
    }
    bcrypt.hash(password.newPassword, 10, (_err, hash) => {
      this.connection.getRepository(User).update(db_user, {
        password: hash,
      });
    });
  }

  async deleteAccount(password: string, user) {
    this.logger.debug('Attempting deletion of the user ' + user.username);
    const valid = await this.validateUser(user.username, password);

    if (!valid) {
      throw new HttpException(
        'Your password is invalid!',
        HttpStatus.FORBIDDEN,
      );
    }

    const db_user = await this.usersService.findOne(user.username);

    if (!db_user) {
      throw new HttpException('User not found!', HttpStatus.NOT_FOUND);
    }

    // First delete points, then guesses
    this.logger.debug('Deleting points for ' + user.username);
    const toDeletePoints = await this.connection.getRepository(Points).find({
      where: {
        user: db_user,
      },
    });

    await this.connection.getRepository(Points).remove(toDeletePoints);

    this.logger.debug('Deleting guesses for ' + user.username);
    const toDeleteGuesses = await this.connection.getRepository(Guess).find({
      where: {
        user: db_user,
      },
    });
    await this.connection.getRepository(Guess).remove(toDeleteGuesses);

    // Then delete groups & memberships
    this.logger.debug('Deleting groups owned by ' + user.username);
    const groups = await this.connection.getRepository(Group).find({
      where: { owner: db_user },
    });

    const groupRepository = this.connection.getRepository(Group);

    for (let i = 0; i < groups.length; i++) {
      const db = db_user;
      const group_id = groups[i].id;
      if (db) {
        const dbgroup = await groupRepository.findOne({
          where: { id: group_id },
        });

        if (dbgroup) {
          if (dbgroup.owner.id != db.id) {
            continue;
          }
          const toDeletePoints = await this.connection
            .getRepository(Points)
            .find({
              where: {
                group: dbgroup,
              },
            });
          await this.connection.getRepository(Points).remove(toDeletePoints);

          const toDeleteGuesses = await this.connection
            .getRepository(Guess)
            .find({
              where: {
                group: dbgroup,
              },
            });
          await this.connection.getRepository(Guess).remove(toDeleteGuesses);

          const toDeleteGroupMember = await this.connection
            .getRepository(GroupMembers)
            .find({
              where: {
                group: dbgroup,
              },
            });
          await this.connection
            .getRepository(GroupMembers)
            .remove(toDeleteGroupMember);

          await this.connection.getRepository(Group).remove(dbgroup);
        } else {
          throw new HttpException(
            'The requested group was not found.',
            HttpStatus.NOT_FOUND,
          );
        }
      } else {
        throw new HttpException(
          'You are not allowed to do that!',
          HttpStatus.UNAUTHORIZED,
        );
      }
    }

    this.logger.debug('Deleting group memberships for ' + user.username);
    const userGroups = await this.connection.getRepository(GroupMembers).find({
      where: { user: db_user },
    });

    for (let i = 0; i < userGroups.length; i++) {
      const db = db_user;
      const group_id = userGroups[i].group.id;
      if (db) {
        const dbgroup = await groupRepository.findOne({
          where: { id: group_id },
        });

        if (dbgroup) {
          if (dbgroup.owner.id == db.id) {
            continue;
          }
          const toDeletePoints = await this.connection
            .getRepository(Points)
            .find({
              where: {
                user: db,
                group: dbgroup,
              },
            });
          await this.connection.getRepository(Points).remove(toDeletePoints);

          const toDeleteGuesses = await this.connection
            .getRepository(Guess)
            .find({
              where: {
                user: db,
                group: dbgroup,
              },
            });
          await this.connection.getRepository(Guess).remove(toDeleteGuesses);

          const toDeleteGroupMember = await this.connection
            .getRepository(GroupMembers)
            .find({
              where: {
                user: db,
                group: dbgroup,
              },
            });
          await this.connection
            .getRepository(GroupMembers)
            .remove(toDeleteGroupMember);
        } else {
          throw new HttpException(
            'The requested group was not found.',
            HttpStatus.NOT_FOUND,
          );
        }
      } else {
        throw new HttpException(
          'You are not allowed to do that!',
          HttpStatus.UNAUTHORIZED,
        );
      }
    }

    // Delete account
    this.logger.debug('Deleting user ' + user.username);
    this.usersService.deleteUser(db_user);
  }

  async changeEmail(email: ChangeEmailDto, user) {
    this.logger.debug('Changing email for ' + user.username);
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
