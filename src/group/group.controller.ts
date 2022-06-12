import { Body, Controller, Get, Param, Post, Request } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ChangeNameDto } from 'src/dtos/change-name.dto';
import { CreateGroupDto } from 'src/dtos/create-group.dto';
import { JoinGroupDto } from 'src/dtos/join-group.dto';
import { GroupService } from './group.service';

@Controller('group')
@ApiBearerAuth('access-token')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Get('/user/all')
  getGroups(@Request() req) {
    return this.groupService.getGroups(req.user);
  }

  @Get('/user/:group_id')
  getSingleGroup(@Request() req, @Param('group_id') group_id: number) {
    return this.groupService.getSingleGroup(req.user, group_id);
  }

  @Post('/join')
  joinGroup(@Request() req, @Body() body: JoinGroupDto) {
    return this.groupService.joinGroup(req.user, body);
  }

  @Post('/new')
  createGroup(@Request() req, @Body() body: CreateGroupDto) {
    return this.groupService.createGroup(req.user, body);
  }

  @Get('/leave/:group_id')
  leaveGroup(@Request() req, @Param('group_id') group_id: number) {
    return this.groupService.leaveGroup(req.user, group_id);
  }

  @Get('/delete/:group_id')
  deleteGroup(@Request() req, @Param('group_id') group_id: number) {
    return this.groupService.deleteGroup(req.user, group_id);
  }

  @Post('/rename/:group_id')
  renameGroup(
    @Request() req,
    @Param('group_id') group_id: number,
    @Body() body: ChangeNameDto,
  ) {
    return this.groupService.renameGroup(req.user, group_id, body);
  }
}
