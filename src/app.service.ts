import { Injectable } from '@nestjs/common';
import { appVersion } from './main';
import { Connection } from 'typeorm';
import { PatchNotes } from './database/entities/patch-notes.entity';
import { User } from './database/entities/user.entity';

@Injectable()
export class AppService {
  constructor(
    private connection: Connection,
  ) { }
  getHello(): string {
    return 'Hello World!';
  }

  getVersion(): string {
    return appVersion;
  }

  async getPatchNotes(versionNumber: string, user: { username: any; }) {
    const dbuser = await this.connection.getRepository(User).findOne({
      where: {
        name: user.username
      }
    })

    if (dbuser.last_seen_version == versionNumber) {
      return []
    }
    

    if (dbuser) {
      const dbNotes = await this.connection.getRepository(PatchNotes).findOne({
        where: {
          version: versionNumber
        }
      });

      // "2.9.5" is the first version in patch notes
      let lastVersion = dbuser.last_seen_version
      if (!lastVersion) {
        lastVersion = "2.9.4"
      }

      const userNotes = await this.connection.getRepository(PatchNotes).findOne({
        where: {
          version: lastVersion
        }
      })

      const allPreviousNotes = await this.connection.getRepository(PatchNotes).createQueryBuilder('patch_notes')
        .where(
          'id <= :user_version AND id > :last_seen_version',
          {
            user_version: dbNotes.id,
            last_seen_version: userNotes.id
          },
        )
        .getMany();
      
      await this.connection.getRepository(User).update(dbuser, {
        last_seen_version: versionNumber
      })
        
      return allPreviousNotes.map((value) => {
        return {version: value.version, changes: value.changes}
      }).reverse()
    }
  }
}
