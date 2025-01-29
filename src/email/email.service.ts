import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Game } from 'src/database/entities/game.entity';
import { Guess } from 'src/database/entities/guess.entity';
import { User } from 'src/database/entities/user.entity';
import { Connection, In, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Season } from 'src/database/entities/season.entity';
import { EmailNotify } from 'src/database/entities/email-notify.entity';
import { Group } from 'src/database/entities/group.entity';
import { GroupMembers } from 'src/database/entities/group-members.entity';

@Injectable()
export class EmailService {
  private moment = require('moment');
  private sgMail = require('@sendgrid/mail');
  private readonly logger = new Logger(EmailService.name);


  constructor(
      @InjectRepository(Game)
      private gameRepository: Repository<Game>,
      @InjectRepository(Guess)
      private guessRepository: Repository<Guess>,
      @InjectRepository(User)
      private userRepository: Repository<User>,
      private connection: Connection,
  ) {
      this.sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  }

  @Cron('15 12 * * *', { name: 'notifications-email' })
  async handleNotifications() {
    this.logger.debug('Checking for games today and tomorrow');

    const importantSeasons = await this.getActiveSeasons(1);
    for (let i = 0; i < importantSeasons.length; i++) {
      const season = importantSeasons[i];
      const games = await this.getGamesForSeason(season);

      const [gamedaysToday, gameIDsToday] = this.getGamesInNDays(games, 0);

      const usersToday = (await this.connection.getRepository(EmailNotify).find({
        where: {
          season: season,
          day_of: true,
        }
      })).map((val => {return val.user}));
      

      const usersTomorrow = (await this.connection.getRepository(EmailNotify).find({
        where: {
          season: season,
          day_before: true,
        }
      })).map((val => {return val.user}));

      const notifyUsersToday = await this.filterUsersByGuesses(
        usersToday,
        gameIDsToday,
        season,
      );
  
      const [gamedaysTomorrow, gameIDsTomorrow] = this.getGamesInNDays(games, 1);

      const notifyUsersTomorrow = await this.filterUsersByGuesses(
        usersTomorrow,
        gameIDsTomorrow,
        season,
      );
  
      gamedaysTomorrow.sort((x, y) => x - y);
      gamedaysToday.sort((x, y) => x - y);
  
      if (gamedaysToday.length > 0)
        this.sendNotification(
          season.name,
          gamedaysToday,
          true,
          notifyUsersToday,
        );
  
      if (gamedaysTomorrow.length > 0)
        this.sendNotification(
          season.name,
          gamedaysTomorrow,
          false,
          notifyUsersTomorrow,
        );
    }
  }

  async getActiveSeasons(importance: number) {
    let activeGroups = await this.connection.getRepository(Group).find();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() - 8);
    activeGroups = activeGroups.filter((s) => {
      return (
        s.season.important == importance &&
        s.season.start_date < new Date() &&
        s.season.end_date > nextWeek &&
        s.season.current
      );
    });

    const seasons: Season[] = [];
    for (let i = 0; i < activeGroups.length; i++) {
      const season = activeGroups[i].season;
      const seasonID = activeGroups[i].season.id;
      const filtered = seasons.filter((seas) => {
        if (seas.id != seasonID) {
          return false;
        } else {
          return true;
        }
      });
      if (filtered.length == 0) {
        seasons.push(season);
      }
    }
    return seasons;
  }

  async getGamesForSeason(season: Season) {
    const games = await this.gameRepository.find({
      where: {
        season: season,
      },
    });
    return games;
  }

  getGamesInNDays(games: any, n: number) {
    const gamedays: number[] = [];
    const gameIDs: number[] = [];

    for (const game of games) {
      if (this.moment(game.date).isSame(this.moment().add(n, 'days'), 'day')) {
        // there is a game tomorrow
        gameIDs.push(game.id);
        if (!gamedays.includes(game.gameday)) gamedays.push(game.gameday);
      }
    }
    return [gamedays, gameIDs];
  }

  async filterUsersByGuesses(users, gameIDs, season) {
    const notGuessed: User[] = [];
    for (const dbuser of users) {
      const dbGuessesForUser = await this.guessRepository.find({
        relations: { game: true },
        select: { game: { id: true } },
        where: {
          user: dbuser,
          game: {
            id: In(gameIDs),
            season: season,
          },
        },
      });
      const guessedGameIDs = dbGuessesForUser.map((val) => {
        return val.game.id;
      });

      const missingGameIDs = gameIDs.filter((val: number) => {
        return !guessedGameIDs.includes(val);
      });

      if (missingGameIDs.length > 0) notGuessed.push(dbuser);
    }

    return notGuessed;
  }

  sendNotification(
    seasonName: string,
    gamedays: number[],
    today: boolean,
    users: User[],
  ) {
    let days = '';
    if (gamedays.length == 0) {
      this.logger.debug('No Games');
      return;
    } else if (gamedays.length == 1) {
      this.logger.debug('There is a game');
      if (gamedays[0] == -1) {
        days = 'Gameday: Playoffs'
      } else {
        days = 'Gameday: ' + gamedays[0];
      }
    } else if (gamedays.length > 1) {
      this.logger.debug('There are games');
      days = 'Gamedays: ';
      for (let i = 0; i < gamedays.length - 1; i++) {
        if (gamedays[i] == -1) {
          days += 'Playoffs, ';
        } else {
          days += gamedays[i] + ', ';
        }
      }
      if (gamedays[gamedays.length - 1] == -1) {
        days += "Playoffs";
      } else {
        days += gamedays[gamedays.length - 1];
      }
    }

    const recepients = [];

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      if (today) {
        recepients.push({
          to: [
            {
              name: user.name,
              email: user.email,
            },
          ],
          dynamic_template_data: {
            name: user.name,
            season: seasonName,
            gamedays: days,
            day: 'TODAY',
            subject: 'TopTips Reminder - There are games TODAY!',
          },
        });
      } else {
        recepients.push({
          to: [
            {
              name: user.name,
              email: user.email,
            },
          ],
          dynamic_template_data: {
            name: user.name,
            season: seasonName,
            gamedays: days,
            day: 'tomorrow',
            subject: 'TopTips Reminder - There are games tomorrow.',
          },
        });
      }
    }
    if (recepients.length > 0) {
      const msg = {
        from: { name: 'TopTips', email: 'toptips@kalmbach.dev' },
        subject: today
          ? 'TopTips Reminder - There are games TODAY!'
          : 'TopTips Reminder - There are games tomorrow.',
        personalizations: recepients,
        template_id: 'd-bfee3bf938974af998f60f068f4171c2',
      };

      this.sgMail
        .send(msg)
        .then(() => {
          this.logger.debug('Email sent');
        })
        .catch((error: any) => {
          this.logger.error(error);
        });
    }
  }

  async subscribeToNotification(user, seasonID: number, today: boolean) {
    this.logger.debug('Attempting subscribing for ' + user.username);
    const dbuser = await this.connection.getRepository(User).findOne({
      where: { name: user.username },
    });

    const dbseason = await this.connection.getRepository(Season).findOne({
      where: { id: seasonID },
    });

    if (dbuser && dbseason) {
      const dbemailnotify = await this.connection.getRepository(EmailNotify).findOne({
        where: {user: dbuser, season: dbseason}
      })

      if (dbemailnotify) {
        if (today) {
          this.logger.debug('Subscribing for ' + user.username + " to dayof notifications.");
          await this.connection.getRepository(EmailNotify).update(dbemailnotify, {day_of: true})
        } else {
          this.logger.debug('Subscribing for ' + user.username + " to day before notifications.");
          await this.connection.getRepository(EmailNotify).update(dbemailnotify, {day_before: true})
        }
      } else {
          this.logger.debug('Adding subscription for ' + user.username + " with dayOf: " + today);
          await this.connection.getRepository(EmailNotify).insert({
            user: dbuser,
            season: dbseason,
            day_of: today,
            day_before: !today,
          })
      }
    }
    return this.getSubscriptions(user)
  }
  
  async unsubscribeFromNotification(user, seasonID: number, today: boolean) {
    this.logger.debug('Attempting unsubscribing for ' + user.username);
    const dbuser = await this.connection.getRepository(User).findOne({
      where: { name: user.username },
    });

    const dbseason = await this.connection.getRepository(Season).findOne({
      where: { id: seasonID },
    });

    if (dbuser && dbseason) {
      const dbemailnotify = await this.connection.getRepository(EmailNotify).findOne({
        where: {user: dbuser, season: dbseason}
      })

      if (dbemailnotify) {
        if (today) {
          this.logger.debug('Unsubscribing for ' + user.username + " to dayof notifications.");
          await this.connection.getRepository(EmailNotify).update(dbemailnotify, {day_of: false})
        } else {
          this.logger.debug('Unsubscribing for ' + user.username + " to day before notifications.");
          await this.connection.getRepository(EmailNotify).update(dbemailnotify, {day_before: false})
        }
      } else {
          this.logger.debug('Adding subscription for ' + user.username + " with dayOf: " + today);
          await this.connection.getRepository(EmailNotify).insert({
            user: dbuser,
            season: dbseason,
            day_of: false,
            day_before: false,
          })
      }
    }
    return this.getSubscriptions(user)
  }

  async getSubscriptions(user) {
    const dbuser = await this.connection.getRepository(User).findOne({
      where: { name: user.username },
    });
    if (dbuser) {
      const dbgroupmemberships = await this.connection
        .getRepository(GroupMembers)
        .find({
          where: {
            user: dbuser,
          },
        });

      const seasonArray: Season[] = [];
      const groupIDArray: number[] = [];

      const importantSeasons = await this.getActiveSeasons(1);
      const activeID = importantSeasons.map((seas) => {
        return seas.id;
      });
      for (const group of dbgroupmemberships) {
        const dbgroup = await this.connection
          .getRepository(Group)
          .findOne({ where: group.group });

        if (dbgroup) {
          if (
            activeID.includes(dbgroup.season.id) &&
            !groupIDArray.includes(dbgroup.season.id)
          ) {
            seasonArray.push(dbgroup.season);
            groupIDArray.push(dbgroup.season.id);
          }
        }
      }
      for (let i = 0; i < seasonArray.length; i++) {
        const dbseason = seasonArray[i]
        const dbEmail = await this.connection.getRepository(EmailNotify).findOne({where: {
          user: dbuser,
          season: dbseason,
        }})
        if (!dbEmail) {
          await this.connection.getRepository(EmailNotify).insert({
            user: dbuser,
            season: dbseason,
            day_of: false,
            day_before: false,
          })
        }        
      }
    }

    let dbemailnotify = await this.connection.getRepository(EmailNotify).find({
      where: {user: dbuser}
    })

    return dbemailnotify
  }
}
