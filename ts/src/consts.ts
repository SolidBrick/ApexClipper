export const kGamesFeatures = new Map<number, string[]>([
  // Apex
  [21566, ["game_mode", "damage", "kill", "kill_feed"]],
]);

export const kGameClassIds = Array.from(kGamesFeatures.keys());

export const kWindowNames = {
  inGame: "in_game",
  desktop: "desktop",
  notification: "notification",
};

export const kHotkeys = {
  toggle: "sample_app_ts_showhide",
};
