export class TeamDetails {
  name: string;
  team_id: number;
  position: number;
  win: number;
  draw: number;
  lose: number;
  goals_for: number;
  goals_against: number;
  points: number;
  history: string;

  constructor(
    name?: string,
    team_id?: number,
    position?: number,
    win?: number,
    draw?: number,
    lose?: number,
    goals_for?: number,
    goals_against?: number,
    points?: number,
    history?: string,
  ) {
    this.name = name;
    this.team_id = team_id;
    this.position = position;
    this.win = win;
    this.draw = draw;
    this.lose = lose;
    this.goals_for = goals_for;
    this.goals_against = goals_against;
    this.points = points;
    this.history = history;
  }

  static fromJSON(d: Object): TeamDetails {
    return Object.assign(new TeamDetails(), d);
}
}
