import { Test, TestingModule } from '@nestjs/testing';
import { GuessService } from './guess.service';

describe('GuessService', () => {
  let service: GuessService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GuessService],
    }).compile();

    service = module.get<GuessService>(GuessService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
