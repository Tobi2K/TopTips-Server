import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import * as admin from "firebase-admin";
import { Game } from 'src/database/entities/game.entity';
import { Connection } from 'typeorm';

@Injectable()
export class CronService {
    constructor(
        private connection: Connection
    ) { }

    @Cron(CronExpression.EVERY_DAY_AT_11AM)
    async handleCron() {
        console.log("Sending Notifications")
        const x = await this.connection.getRepository(Game).find({
            select: ['date'],
            order: { 'date': "ASC" }
        });
        for (let i = 0; i < x.length; i++) {
            const element = x[i].date;
            const currentDate = new Date();
            if (element.getFullYear() == currentDate.getFullYear() && element.getMonth() == currentDate.getMonth() && element.getDate() == currentDate.getDate()) {
                console.log("There is a game today");
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
                        console.log('Successfully sent message:', response);
                    })
                    .catch((error) => {
                        console.log('Error sending message:', error);
                    });
                break;
            } else if (element.getFullYear() == currentDate.getFullYear() && element.getMonth() == currentDate.getMonth() && element.getDate() > currentDate.getDate()) {
                console.log("Breaking because day is larger than today");
                break;
            } else if (element.getFullYear() == currentDate.getFullYear() && element.getMonth() > currentDate.getMonth()) {
                console.log("Breaking because month is larger than today");
                break;
            } else if (element.getFullYear() > currentDate.getFullYear()) {
                console.log("Breaking because year is larger than today");
                break;
            }
        }
    }
}
