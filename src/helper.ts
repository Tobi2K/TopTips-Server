export class TeamDetails {
  name: string;
  team_id: number;
  position: number;
  win: number;
  draw: number;
  lose: number;
  goals_for: number;
  goals_against: number;
  goals_max: number;
  goals_min: number;
  goals_avg: number;
  points: number;
  history: {
    result: string;
    scores_home_team: number[];
    scores_away_team: number[];
    other_team_name: string[];
  };

  constructor(
    name?: string,
    team_id?: number,
    position?: number,
    win?: number,
    draw?: number,
    lose?: number,
    goals_for?: number,
    goals_against?: number,
    goals_max?: number,
    goals_min?: number,
    goals_avg?: number,
    points?: number,
    history?: {
      result: string;
      scores_home_team: number[];
      scores_away_team: number[];
      other_team_name: string[];
    },
  ) {
    this.name = name;
    this.team_id = team_id;
    this.position = position;
    this.win = win;
    this.draw = draw;
    this.lose = lose;
    this.goals_for = goals_for;
    this.goals_against = goals_against;
    this.goals_max = goals_max;
    this.goals_min = goals_min;
    this.goals_avg = goals_avg;
    this.points = points;
    this.history = history;
  }

  static fromJSON(d: object): TeamDetails {
    return Object.assign(new TeamDetails(), d);
  }
}
