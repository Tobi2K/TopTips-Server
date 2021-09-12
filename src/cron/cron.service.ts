import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import * as admin from "firebase-admin";
import { Game } from 'src/database/entities/game.entity';
import { Connection } from 'typeorm';

@Injectable()
export class CronService {
    private readonly logger = new Logger(CronService.name);
    constructor(
        private connection: Connection,
    ) { }

    @Cron(CronExpression.EVERY_DAY_AT_10AM)
    async handleCron() {
        this.logger.debug("Checking for games today")
        const x = await this.connection.getRepository(Game).find({
            select: ['date'],
            order: { 'date': "ASC" }
        });
        for (let i = 0; i < x.length; i++) {
            const element = x[i].date;
            const currentDate = new Date();
            if (element.getFullYear() == currentDate.getFullYear() && element.getMonth() == currentDate.getMonth() && element.getDate() == currentDate.getDate()) {
                this.logger.debug("There is a game today");
                const topic = "games"
                const message = {
                    notification: {
                        title: 'Schon getippt?',
                        body: 'Heute finden Spiele statt.'
                    },
                    android: {
                        notification: {
                            channelId: 'Games'
                        }
                    },
                    topic: topic
                };

                admin.messaging().send(message)
                    .then((response) => {
                        // Response is a message ID string.
                        this.logger.debug('Successfully sent message:', response);
                    })
                    .catch((error) => {
                        this.logger.error('Error sending message:', error);
                    });
                break;
            } else if (element.getFullYear() == currentDate.getFullYear() && element.getMonth() == currentDate.getMonth() && element.getDate() > currentDate.getDate()) {
                this.logger.debug("Breaking because day is larger than today");
                break;
            } else if (element.getFullYear() == currentDate.getFullYear() && element.getMonth() > currentDate.getMonth()) {
                this.logger.debug("Breaking because month is larger than today");
                break;
            } else if (element.getFullYear() > currentDate.getFullYear()) {
                this.logger.debug("Breaking because year is larger than today");
                break;
            }
        }
    }
}
