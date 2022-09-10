import { Test, TestingModule } from '@nestjs/testing';
import { StandingService } from './standing.service';

describe('StandingService', () => {
  let service: StandingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StandingService],
    }).compile();

    service = module.get<StandingService>(StandingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
