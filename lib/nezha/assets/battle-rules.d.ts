declare const rules: {
  towerObjective(floor: number): { mini: boolean; goal: number };
  towerMinimumKills(cleared: number): number;
};
export default rules;
