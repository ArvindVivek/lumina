-- Seed data for Lumina VALORANT Analytics
-- Sufficient sample data to test all 7 player insight endpoints

-- Tournament
INSERT INTO lumina.tournaments (id, name, start_date, end_date, parent_id) VALUES
('tournament-001', 'VCT Americas Kickoff 2024', '2024-02-15', '2024-03-15', NULL);

-- Teams
INSERT INTO lumina.teams (id, name) VALUES
('team-cloud9', 'Cloud9'),
('team-sentinels', 'Sentinels');

-- Players (5 per team for full roster)
INSERT INTO lumina.players (id, name, team_id) VALUES
('player-c9-jakee', 'jakee', 'team-cloud9'),
('player-c9-oxy', 'oxy', 'team-cloud9'),
('player-c9-xeppaa', 'Xeppaa', 'team-cloud9'),
('player-c9-moose', 'moose', 'team-cloud9'),
('player-c9-wippie', 'wippie', 'team-cloud9'),
('player-sen-tenz', 'TenZ', 'team-sentinels'),
('player-sen-zekken', 'zekken', 'team-sentinels'),
('player-sen-johnqt', 'johnqt', 'team-sentinels'),
('player-sen-zellsis', 'zellsis', 'team-sentinels'),
('player-sen-sacy', 'Sacy', 'team-sentinels');

-- Series
INSERT INTO lumina.series (id, tournament_id, start_time, format, team_a_id, team_b_id, winner_id, processed) VALUES
('series-001', 'tournament-001', '2024-02-16T18:00:00Z', 'bo3', 'team-cloud9', 'team-sentinels', 'team-cloud9', true);

-- Games (3 maps in bo3)
INSERT INTO lumina.games (id, series_id, sequence_number, map_name, team_a_score, team_b_score, winner_id, duration_ms) VALUES
('game-001', 'series-001', 1, 'Ascent', 13, 11, 'team-cloud9', 2400000),
('game-002', 'series-001', 2, 'Haven', 10, 13, 'team-sentinels', 2200000),
('game-003', 'series-001', 3, 'Lotus', 13, 8, 'team-cloud9', 1900000);

-- Rounds (24 rounds for game 1, simplified to 10 for seed)
INSERT INTO lumina.rounds (id, game_id, round_number, phase, winning_team_id, winning_condition, spike_planted, spike_defused, team_a_alive, team_b_alive, team_a_loadout_value, team_b_loadout_value, duration_ms) VALUES
-- Game 1 - Ascent rounds
('round-001-01', 'game-001', 1, 'Pistol', 'team-cloud9', 'Elimination', true, false, 3, 0, 800, 800, 95000),
('round-001-02', 'game-001', 2, 'Eco', 'team-cloud9', 'Detonation', true, false, 4, 0, 4500, 2000, 85000),
('round-001-03', 'game-001', 3, 'Full Buy', 'team-sentinels', 'Elimination', false, false, 0, 2, 4200, 4500, 110000),
('round-001-04', 'game-001', 4, 'Full Buy', 'team-cloud9', 'Elimination', true, false, 2, 0, 4500, 4500, 102000),
('round-001-05', 'game-001', 5, 'Full Buy', 'team-cloud9', 'Defuse', true, true, 1, 0, 4500, 4300, 115000),
('round-001-06', 'game-001', 6, 'Eco', 'team-cloud9', 'Elimination', false, false, 5, 0, 4500, 1500, 55000),
('round-001-07', 'game-001', 7, 'Force Buy', 'team-sentinels', 'Elimination', true, false, 0, 3, 4200, 3200, 98000),
('round-001-08', 'game-001', 8, 'Full Buy', 'team-sentinels', 'Time Expired', false, false, 2, 3, 4500, 4500, 120000),
('round-001-09', 'game-001', 9, 'Full Buy', 'team-cloud9', 'Detonation', true, false, 1, 0, 4500, 4500, 108000),
('round-001-10', 'game-001', 10, 'Full Buy', 'team-cloud9', 'Elimination', false, false, 3, 0, 4500, 4500, 92000),
-- Game 2 - Haven rounds
('round-002-01', 'game-002', 1, 'Pistol', 'team-sentinels', 'Elimination', false, false, 0, 4, 800, 800, 88000),
('round-002-02', 'game-002', 2, 'Eco', 'team-sentinels', 'Elimination', false, false, 0, 5, 1500, 4500, 45000),
('round-002-03', 'game-002', 3, 'Full Buy', 'team-cloud9', 'Detonation', true, false, 2, 0, 4500, 4200, 105000),
('round-002-04', 'game-002', 4, 'Full Buy', 'team-sentinels', 'Elimination', true, false, 0, 1, 4500, 4500, 112000),
('round-002-05', 'game-002', 5, 'Full Buy', 'team-sentinels', 'Defuse', true, true, 0, 2, 4500, 4500, 118000),
-- Game 3 - Lotus rounds
('round-003-01', 'game-003', 1, 'Pistol', 'team-cloud9', 'Detonation', true, false, 4, 0, 800, 800, 90000),
('round-003-02', 'game-003', 2, 'Eco', 'team-cloud9', 'Elimination', false, false, 5, 0, 4500, 1800, 50000),
('round-003-03', 'game-003', 3, 'Full Buy', 'team-cloud9', 'Elimination', true, false, 3, 0, 4500, 4500, 95000),
('round-003-04', 'game-003', 4, 'Full Buy', 'team-sentinels', 'Elimination', false, false, 0, 2, 4500, 4500, 108000),
('round-003-05', 'game-003', 5, 'Full Buy', 'team-cloud9', 'Detonation', true, false, 2, 0, 4500, 4500, 102000);

-- Player Round Stats (10 players x 20 rounds = 200 entries, showing representative sample)
-- jakee stats (strong duelist, high first kills, good clutch)
INSERT INTO lumina.player_round_stats (round_id, player_id, team_id, agent, kills, deaths, assists, damage_dealt, damage_taken, first_kill, first_death, traded, got_trade, clutch_situation, clutch_won, loadout_value, armor, ultimate_points, ultimate_used, ability_casts) VALUES
('round-001-01', 'player-c9-jakee', 'team-cloud9', 'Jett', 2, 0, 1, 250, 80, true, false, false, false, false, false, 800, 0, 3, false, 2),
('round-001-02', 'player-c9-jakee', 'team-cloud9', 'Jett', 3, 0, 0, 320, 40, true, false, false, false, false, false, 4500, 50, 5, false, 3),
('round-001-03', 'player-c9-jakee', 'team-cloud9', 'Jett', 1, 1, 0, 150, 150, false, true, true, false, false, false, 4200, 50, 7, true, 2),
('round-001-04', 'player-c9-jakee', 'team-cloud9', 'Jett', 2, 1, 1, 280, 120, true, false, false, false, false, false, 4500, 50, 2, false, 2),
('round-001-05', 'player-c9-jakee', 'team-cloud9', 'Jett', 1, 1, 0, 150, 150, false, false, false, true, true, true, 4500, 50, 4, false, 1),
('round-001-06', 'player-c9-jakee', 'team-cloud9', 'Jett', 3, 0, 0, 350, 0, true, false, false, false, false, false, 4500, 50, 6, false, 2),
('round-001-07', 'player-c9-jakee', 'team-cloud9', 'Jett', 0, 1, 0, 80, 150, false, false, true, false, false, false, 4200, 50, 7, false, 1),
('round-001-08', 'player-c9-jakee', 'team-cloud9', 'Jett', 1, 0, 0, 120, 60, false, false, false, false, false, false, 4500, 50, 2, true, 2),
('round-001-09', 'player-c9-jakee', 'team-cloud9', 'Jett', 2, 1, 0, 230, 150, true, false, false, false, true, true, 4500, 50, 4, false, 2),
('round-001-10', 'player-c9-jakee', 'team-cloud9', 'Jett', 2, 0, 1, 200, 30, false, false, false, false, false, false, 4500, 50, 6, false, 3),
-- Game 2 jakee stats
('round-002-01', 'player-c9-jakee', 'team-cloud9', 'Jett', 0, 1, 0, 60, 150, false, true, false, false, false, false, 800, 0, 3, false, 1),
('round-002-02', 'player-c9-jakee', 'team-cloud9', 'Jett', 0, 1, 0, 40, 150, false, false, false, false, false, false, 1500, 0, 4, false, 0),
('round-002-03', 'player-c9-jakee', 'team-cloud9', 'Jett', 2, 1, 1, 280, 150, true, false, false, false, false, false, 4500, 50, 6, false, 2),
('round-002-04', 'player-c9-jakee', 'team-cloud9', 'Jett', 1, 1, 0, 150, 150, false, true, true, false, false, false, 4500, 50, 7, false, 2),
('round-002-05', 'player-c9-jakee', 'team-cloud9', 'Jett', 1, 1, 0, 140, 150, false, false, false, false, true, false, 4500, 50, 2, true, 1),
-- Game 3 jakee stats
('round-003-01', 'player-c9-jakee', 'team-cloud9', 'Jett', 2, 0, 0, 260, 40, true, false, false, false, false, false, 800, 0, 3, false, 2),
('round-003-02', 'player-c9-jakee', 'team-cloud9', 'Jett', 2, 0, 1, 220, 0, false, false, false, false, false, false, 4500, 50, 5, false, 2),
('round-003-03', 'player-c9-jakee', 'team-cloud9', 'Jett', 2, 0, 0, 200, 60, true, false, false, false, false, false, 4500, 50, 7, true, 3),
('round-003-04', 'player-c9-jakee', 'team-cloud9', 'Jett', 0, 1, 0, 80, 150, false, false, true, false, false, false, 4500, 50, 2, false, 1),
('round-003-05', 'player-c9-jakee', 'team-cloud9', 'Jett', 1, 0, 1, 150, 80, false, false, false, false, false, false, 4500, 50, 4, false, 2);

-- TenZ stats (another duelist for comparison, good opening duels but more deaths)
INSERT INTO lumina.player_round_stats (round_id, player_id, team_id, agent, kills, deaths, assists, damage_dealt, damage_taken, first_kill, first_death, traded, got_trade, clutch_situation, clutch_won, loadout_value, armor, ultimate_points, ultimate_used, ability_casts) VALUES
('round-001-01', 'player-sen-tenz', 'team-sentinels', 'Jett', 0, 1, 0, 80, 150, false, true, true, false, false, false, 800, 0, 3, false, 2),
('round-001-02', 'player-sen-tenz', 'team-sentinels', 'Jett', 0, 1, 0, 40, 150, false, true, true, false, false, false, 2000, 0, 4, false, 1),
('round-001-03', 'player-sen-tenz', 'team-sentinels', 'Jett', 2, 0, 1, 280, 80, true, false, false, false, false, false, 4500, 50, 6, false, 3),
('round-001-04', 'player-sen-tenz', 'team-sentinels', 'Jett', 1, 1, 0, 150, 150, true, false, false, false, false, false, 4500, 50, 7, false, 2),
('round-001-05', 'player-sen-tenz', 'team-sentinels', 'Jett', 1, 1, 0, 140, 150, false, true, true, false, false, false, 4500, 50, 2, true, 2),
('round-001-06', 'player-sen-tenz', 'team-sentinels', 'Jett', 0, 1, 0, 20, 150, false, false, false, false, false, false, 1500, 0, 3, false, 0),
('round-001-07', 'player-sen-tenz', 'team-sentinels', 'Jett', 2, 0, 0, 250, 60, true, false, false, true, false, false, 3200, 25, 5, false, 2),
('round-001-08', 'player-sen-tenz', 'team-sentinels', 'Jett', 1, 0, 1, 120, 40, false, false, false, false, false, false, 4500, 50, 7, false, 2),
('round-001-09', 'player-sen-tenz', 'team-sentinels', 'Jett', 1, 1, 0, 150, 150, false, false, true, false, true, false, 4500, 50, 2, true, 2),
('round-001-10', 'player-sen-tenz', 'team-sentinels', 'Jett', 0, 1, 0, 60, 150, false, true, true, false, false, false, 4500, 50, 3, false, 1),
-- Game 2 TenZ stats
('round-002-01', 'player-sen-tenz', 'team-sentinels', 'Jett', 2, 0, 0, 260, 80, true, false, false, false, false, false, 800, 0, 3, false, 2),
('round-002-02', 'player-sen-tenz', 'team-sentinels', 'Jett', 2, 0, 0, 240, 0, true, false, false, false, false, false, 4500, 50, 5, false, 2),
('round-002-03', 'player-sen-tenz', 'team-sentinels', 'Jett', 1, 1, 0, 150, 150, false, true, true, false, false, false, 4200, 50, 7, true, 2),
('round-002-04', 'player-sen-tenz', 'team-sentinels', 'Jett', 2, 0, 1, 280, 60, true, false, false, false, false, false, 4500, 50, 2, false, 3),
('round-002-05', 'player-sen-tenz', 'team-sentinels', 'Jett', 1, 0, 0, 150, 80, false, false, false, false, false, false, 4500, 50, 4, false, 2),
-- Game 3 TenZ stats
('round-003-01', 'player-sen-tenz', 'team-sentinels', 'Jett', 0, 1, 0, 60, 150, false, true, true, false, false, false, 800, 0, 3, false, 1),
('round-003-02', 'player-sen-tenz', 'team-sentinels', 'Jett', 0, 1, 0, 30, 150, false, true, true, false, false, false, 1800, 0, 4, false, 0),
('round-003-03', 'player-sen-tenz', 'team-sentinels', 'Jett', 1, 1, 0, 150, 150, false, false, true, false, false, false, 4500, 50, 6, false, 2),
('round-003-04', 'player-sen-tenz', 'team-sentinels', 'Jett', 2, 0, 1, 280, 80, true, false, false, false, false, false, 4500, 50, 7, false, 3),
('round-003-05', 'player-sen-tenz', 'team-sentinels', 'Jett', 0, 1, 0, 80, 150, false, false, true, false, false, false, 4500, 50, 2, true, 1);

-- Xeppaa stats (controller, lower frag but good support)
INSERT INTO lumina.player_round_stats (round_id, player_id, team_id, agent, kills, deaths, assists, damage_dealt, damage_taken, first_kill, first_death, traded, got_trade, clutch_situation, clutch_won, loadout_value, armor, ultimate_points, ultimate_used, ability_casts) VALUES
('round-001-01', 'player-c9-xeppaa', 'team-cloud9', 'Omen', 1, 0, 1, 150, 60, false, false, false, false, false, false, 800, 0, 3, false, 4),
('round-001-02', 'player-c9-xeppaa', 'team-cloud9', 'Omen', 1, 0, 2, 130, 40, false, false, false, false, false, false, 4500, 50, 5, false, 5),
('round-001-03', 'player-c9-xeppaa', 'team-cloud9', 'Omen', 0, 1, 1, 80, 150, false, false, true, false, false, false, 4200, 50, 7, true, 6),
('round-001-04', 'player-c9-xeppaa', 'team-cloud9', 'Omen', 1, 0, 1, 140, 60, false, false, false, true, false, false, 4500, 50, 2, false, 5),
('round-001-05', 'player-c9-xeppaa', 'team-cloud9', 'Omen', 1, 1, 0, 150, 150, false, false, false, false, false, false, 4500, 50, 4, false, 4),
('round-001-06', 'player-c9-xeppaa', 'team-cloud9', 'Omen', 0, 0, 2, 60, 0, false, false, false, false, false, false, 4500, 50, 6, false, 5),
('round-001-07', 'player-c9-xeppaa', 'team-cloud9', 'Omen', 1, 1, 0, 150, 150, false, true, false, false, false, false, 4200, 50, 7, false, 4),
('round-001-08', 'player-c9-xeppaa', 'team-cloud9', 'Omen', 0, 0, 1, 40, 30, false, false, false, false, false, false, 4500, 50, 2, true, 6),
('round-001-09', 'player-c9-xeppaa', 'team-cloud9', 'Omen', 1, 1, 0, 150, 150, false, false, true, false, false, false, 4500, 50, 4, false, 5),
('round-001-10', 'player-c9-xeppaa', 'team-cloud9', 'Omen', 1, 0, 1, 150, 50, false, false, false, false, false, false, 4500, 50, 6, false, 6);

-- Kill events for first kill/death tracking
INSERT INTO lumina.kill_events (round_id, game_time_ms, killer_id, victim_id, weapon, headshot, wallbang, is_first_kill, is_trade, is_self_kill, killer_pos_x, killer_pos_y, victim_pos_x, victim_pos_y, kill_distance, assist_count) VALUES
-- Round 1 kills
('round-001-01', 15000, 'player-c9-jakee', 'player-sen-tenz', 'Classic', true, false, true, false, false, 100.5, 200.3, 150.2, 210.5, 52.3, 0),
('round-001-01', 25000, 'player-c9-jakee', 'player-sen-zekken', 'Classic', false, false, false, true, false, 110.2, 205.1, 140.8, 215.2, 35.1, 1),
-- Round 2 kills
('round-001-02', 12000, 'player-c9-jakee', 'player-sen-johnqt', 'Vandal', true, false, true, false, false, 200.5, 300.3, 250.2, 310.5, 55.2, 0),
('round-001-02', 18000, 'player-c9-jakee', 'player-sen-zellsis', 'Vandal', false, false, false, false, false, 205.2, 302.1, 260.8, 315.2, 60.1, 0),
('round-001-02', 25000, 'player-c9-jakee', 'player-sen-sacy', 'Vandal', true, false, false, false, false, 210.2, 305.1, 270.8, 320.2, 65.4, 0),
-- Round 3 kills (Sentinels win)
('round-001-03', 18000, 'player-sen-tenz', 'player-c9-jakee', 'Phantom', true, false, true, false, false, 300.5, 400.3, 350.2, 410.5, 52.8, 0),
('round-001-03', 22000, 'player-c9-xeppaa', 'player-sen-zellsis', 'Vandal', false, false, false, true, false, 305.2, 402.1, 360.8, 415.2, 58.3, 1),
-- Round 4 kills
('round-001-04', 10000, 'player-c9-jakee', 'player-sen-zekken', 'Operator', true, false, true, false, false, 400.5, 500.3, 450.2, 510.5, 70.2, 0),
('round-001-04', 20000, 'player-sen-tenz', 'player-c9-moose', 'Phantom', false, false, false, true, false, 405.2, 502.1, 460.8, 515.2, 58.1, 0);

-- Spike events
INSERT INTO lumina.spike_events (round_id, game_time_ms, event_type, player_id, site, pos_x, pos_y) VALUES
('round-001-01', 45000, 'plant', 'player-c9-wippie', 'A', 150.0, 200.0),
('round-001-02', 40000, 'plant', 'player-c9-wippie', 'B', 250.0, 300.0),
('round-001-04', 50000, 'plant', 'player-c9-moose', 'A', 155.0, 205.0),
('round-001-05', 55000, 'plant', 'player-c9-wippie', 'B', 255.0, 305.0),
('round-001-05', 85000, 'defuse', 'player-sen-johnqt', 'B', 255.0, 305.0),
('round-001-09', 48000, 'plant', 'player-c9-moose', 'A', 152.0, 202.0);

-- Scenario index for save/retake analysis
INSERT INTO lumina.scenario_index (round_id, game_id, round_number, attacker_alive, defender_alive, spike_planted, time_remaining_ms, attacker_economy, defender_economy, attacker_won, map_name, tournament_id) VALUES
('round-001-01', 'game-001', 1, 5, 5, false, 100000, 800, 800, true, 'Ascent', 'tournament-001'),
('round-001-02', 'game-001', 2, 5, 5, false, 100000, 4500, 2000, true, 'Ascent', 'tournament-001'),
('round-001-03', 'game-001', 3, 5, 5, false, 100000, 4200, 4500, false, 'Ascent', 'tournament-001'),
('round-001-04', 'game-001', 4, 5, 5, false, 100000, 4500, 4500, true, 'Ascent', 'tournament-001'),
('round-001-05', 'game-001', 5, 5, 5, false, 100000, 4500, 4300, true, 'Ascent', 'tournament-001'),
('round-001-06', 'game-001', 6, 5, 5, false, 100000, 4500, 1500, true, 'Ascent', 'tournament-001'),
('round-001-07', 'game-001', 7, 5, 5, false, 100000, 4200, 3200, false, 'Ascent', 'tournament-001'),
('round-001-08', 'game-001', 8, 5, 5, false, 100000, 4500, 4500, false, 'Ascent', 'tournament-001'),
('round-001-09', 'game-001', 9, 5, 5, false, 100000, 4500, 4500, true, 'Ascent', 'tournament-001'),
('round-001-10', 'game-001', 10, 5, 5, false, 100000, 4500, 4500, true, 'Ascent', 'tournament-001');
