--
-- PostgreSQL database dump
-- Lumina VALORANT Analytics Schema
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ability_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ability_events (
    id bigint NOT NULL,
    round_id text,
    player_id text,
    ability_name text,
    ability_count bigint DEFAULT '1'::bigint,
    created_at text DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: ability_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ability_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ability_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ability_events_id_seq OWNED BY public.ability_events.id;


--
-- Name: games; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.games (
    id text NOT NULL,
    series_id text,
    sequence_number bigint,
    map_name text,
    team_a_score bigint,
    team_b_score bigint,
    winner_id text,
    duration_ms bigint,
    created_at text DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: kill_assists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kill_assists (
    id bigint NOT NULL,
    round_id text,
    kill_index bigint,
    killer_id text,
    assister_id text,
    created_at text DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: kill_assists_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kill_assists_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kill_assists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kill_assists_id_seq OWNED BY public.kill_assists.id;


--
-- Name: kill_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kill_events (
    id bigint NOT NULL,
    round_id text,
    game_time_ms bigint,
    killer_id text,
    victim_id text,
    weapon text,
    headshot boolean DEFAULT false,
    wallbang boolean DEFAULT false,
    is_first_kill boolean DEFAULT false,
    is_trade boolean DEFAULT false,
    is_self_kill boolean DEFAULT false,
    killer_pos_x real,
    killer_pos_y real,
    victim_pos_x real,
    victim_pos_y real,
    kill_distance real,
    assist_count bigint DEFAULT '0'::bigint,
    created_at text DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: kill_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kill_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kill_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kill_events_id_seq OWNED BY public.kill_events.id;


--
-- Name: orb_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orb_events (
    id bigint NOT NULL,
    round_id text,
    game_time_ms bigint,
    player_id text,
    orb_type text,
    pos_x real,
    pos_y real,
    created_at text DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: player_round_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_round_stats (
    id bigint NOT NULL,
    round_id text,
    player_id text,
    team_id text,
    agent text,
    kills bigint DEFAULT '0'::bigint,
    deaths bigint DEFAULT '0'::bigint,
    assists bigint DEFAULT '0'::bigint,
    damage_dealt bigint DEFAULT '0'::bigint,
    damage_taken bigint DEFAULT '0'::bigint,
    first_kill boolean DEFAULT false,
    first_death boolean DEFAULT false,
    traded boolean DEFAULT false,
    got_trade boolean DEFAULT false,
    clutch_situation boolean DEFAULT false,
    clutch_won boolean DEFAULT false,
    loadout_value bigint,
    armor bigint,
    ultimate_points bigint,
    ultimate_used boolean DEFAULT false,
    ability_casts bigint DEFAULT '0'::bigint,
    created_at text DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: player_round_stats_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.player_round_stats_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: player_round_stats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.player_round_stats_id_seq OWNED BY public.player_round_stats.id;


--
-- Name: players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.players (
    id text NOT NULL,
    name text,
    team_id text,
    created_at text DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: rounds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rounds (
    id text NOT NULL,
    game_id text,
    round_number bigint,
    phase text,
    winning_team_id text,
    winning_condition text,
    spike_planted boolean DEFAULT false,
    spike_defused boolean DEFAULT false,
    team_a_alive bigint,
    team_b_alive bigint,
    team_a_loadout_value bigint,
    team_b_loadout_value bigint,
    duration_ms bigint,
    created_at text DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: scenario_index; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario_index (
    id bigint NOT NULL,
    round_id text,
    game_id text,
    round_number bigint,
    attacker_alive bigint,
    defender_alive bigint,
    spike_planted boolean,
    time_remaining_ms bigint,
    attacker_economy bigint,
    defender_economy bigint,
    attacker_won boolean,
    map_name text,
    tournament_id text,
    created_at text DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: scenario_index_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.scenario_index_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: scenario_index_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.scenario_index_id_seq OWNED BY public.scenario_index.id;


--
-- Name: series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.series (
    id text NOT NULL,
    tournament_id text,
    start_time text,
    format text,
    team_a_id text,
    team_b_id text,
    winner_id text,
    processed boolean DEFAULT false,
    created_at text DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: spike_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spike_events (
    id bigint NOT NULL,
    round_id text,
    game_time_ms bigint,
    event_type text,
    player_id text,
    site text,
    pos_x real,
    pos_y real,
    created_at text DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: spike_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.spike_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: spike_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.spike_events_id_seq OWNED BY public.spike_events.id;


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id text NOT NULL,
    name text,
    created_at text DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: tournaments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournaments (
    id text NOT NULL,
    name text,
    start_date text,
    end_date text,
    parent_id text,
    created_at text DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: ability_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ability_events ALTER COLUMN id SET DEFAULT nextval('public.ability_events_id_seq'::regclass);


--
-- Name: kill_assists id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kill_assists ALTER COLUMN id SET DEFAULT nextval('public.kill_assists_id_seq'::regclass);


--
-- Name: kill_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kill_events ALTER COLUMN id SET DEFAULT nextval('public.kill_events_id_seq'::regclass);


--
-- Name: player_round_stats id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_round_stats ALTER COLUMN id SET DEFAULT nextval('public.player_round_stats_id_seq'::regclass);


--
-- Name: scenario_index id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_index ALTER COLUMN id SET DEFAULT nextval('public.scenario_index_id_seq'::regclass);


--
-- Name: spike_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spike_events ALTER COLUMN id SET DEFAULT nextval('public.spike_events_id_seq'::regclass);


--
-- Name: tournaments idx_18437_sqlite_autoindex_tournaments_1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT idx_18437_sqlite_autoindex_tournaments_1 PRIMARY KEY (id);


--
-- Name: teams idx_18443_sqlite_autoindex_teams_1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT idx_18443_sqlite_autoindex_teams_1 PRIMARY KEY (id);


--
-- Name: players idx_18449_sqlite_autoindex_players_1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT idx_18449_sqlite_autoindex_players_1 PRIMARY KEY (id);


--
-- Name: series idx_18455_sqlite_autoindex_series_1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series
    ADD CONSTRAINT idx_18455_sqlite_autoindex_series_1 PRIMARY KEY (id);


--
-- Name: games idx_18462_sqlite_autoindex_games_1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT idx_18462_sqlite_autoindex_games_1 PRIMARY KEY (id);


--
-- Name: rounds idx_18468_sqlite_autoindex_rounds_1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rounds
    ADD CONSTRAINT idx_18468_sqlite_autoindex_rounds_1 PRIMARY KEY (id);


--
-- Name: player_round_stats idx_18477_player_round_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_round_stats
    ADD CONSTRAINT idx_18477_player_round_stats_pkey PRIMARY KEY (id);


--
-- Name: kill_events idx_18498_kill_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kill_events
    ADD CONSTRAINT idx_18498_kill_events_pkey PRIMARY KEY (id);


--
-- Name: spike_events idx_18512_spike_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spike_events
    ADD CONSTRAINT idx_18512_spike_events_pkey PRIMARY KEY (id);


--
-- Name: orb_events idx_18519_orb_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orb_events
    ADD CONSTRAINT idx_18519_orb_events_pkey PRIMARY KEY (id);


--
-- Name: ability_events idx_18526_ability_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ability_events
    ADD CONSTRAINT idx_18526_ability_events_pkey PRIMARY KEY (id);


--
-- Name: kill_assists idx_18535_kill_assists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kill_assists
    ADD CONSTRAINT idx_18535_kill_assists_pkey PRIMARY KEY (id);


--
-- Name: scenario_index idx_18543_scenario_index_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_index
    ADD CONSTRAINT idx_18543_scenario_index_pkey PRIMARY KEY (id);


--
-- Name: idx_18449_idx_players_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18449_idx_players_name ON public.players USING btree (name);


--
-- Name: idx_18449_idx_players_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18449_idx_players_team ON public.players USING btree (team_id);


--
-- Name: idx_18455_idx_series_processed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18455_idx_series_processed ON public.series USING btree (processed);


--
-- Name: idx_18455_idx_series_teams; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18455_idx_series_teams ON public.series USING btree (team_a_id, team_b_id);


--
-- Name: idx_18455_idx_series_tournament; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18455_idx_series_tournament ON public.series USING btree (tournament_id);


--
-- Name: idx_18462_idx_games_map; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18462_idx_games_map ON public.games USING btree (map_name);


--
-- Name: idx_18462_idx_games_series; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18462_idx_games_series ON public.games USING btree (series_id);


--
-- Name: idx_18462_idx_games_series_seq; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18462_idx_games_series_seq ON public.games USING btree (series_id, sequence_number);


--
-- Name: idx_18468_idx_rounds_game; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18468_idx_rounds_game ON public.rounds USING btree (game_id);


--
-- Name: idx_18468_idx_rounds_phase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18468_idx_rounds_phase ON public.rounds USING btree (phase);


--
-- Name: idx_18468_idx_rounds_spike; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18468_idx_rounds_spike ON public.rounds USING btree (spike_planted, spike_defused);


--
-- Name: idx_18468_idx_rounds_winner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18468_idx_rounds_winner ON public.rounds USING btree (winning_team_id);


--
-- Name: idx_18468_idx_rounds_winning_condition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18468_idx_rounds_winning_condition ON public.rounds USING btree (winning_condition);


--
-- Name: idx_18468_sqlite_autoindex_rounds_2; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_18468_sqlite_autoindex_rounds_2 ON public.rounds USING btree (game_id, round_number);


--
-- Name: idx_18477_idx_player_round_stats_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18477_idx_player_round_stats_agent ON public.player_round_stats USING btree (agent);


--
-- Name: idx_18477_idx_player_round_stats_clutch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18477_idx_player_round_stats_clutch ON public.player_round_stats USING btree (clutch_situation);


--
-- Name: idx_18477_idx_player_round_stats_first_death; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18477_idx_player_round_stats_first_death ON public.player_round_stats USING btree (first_death);


--
-- Name: idx_18477_idx_player_round_stats_first_kill; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18477_idx_player_round_stats_first_kill ON public.player_round_stats USING btree (first_kill);


--
-- Name: idx_18477_idx_player_round_stats_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18477_idx_player_round_stats_player ON public.player_round_stats USING btree (player_id);


--
-- Name: idx_18477_idx_player_round_stats_player_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18477_idx_player_round_stats_player_agent ON public.player_round_stats USING btree (player_id, agent);


--
-- Name: idx_18477_idx_player_round_stats_player_first_death; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18477_idx_player_round_stats_player_first_death ON public.player_round_stats USING btree (player_id, first_death);


--
-- Name: idx_18477_idx_player_round_stats_player_first_kill; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18477_idx_player_round_stats_player_first_kill ON public.player_round_stats USING btree (player_id, first_kill);


--
-- Name: idx_18477_idx_player_round_stats_round; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18477_idx_player_round_stats_round ON public.player_round_stats USING btree (round_id);


--
-- Name: idx_18477_idx_player_round_stats_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18477_idx_player_round_stats_team ON public.player_round_stats USING btree (team_id);


--
-- Name: idx_18477_sqlite_autoindex_player_round_stats_1; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_18477_sqlite_autoindex_player_round_stats_1 ON public.player_round_stats USING btree (round_id, player_id);


--
-- Name: idx_18498_idx_kill_events_first_kill; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18498_idx_kill_events_first_kill ON public.kill_events USING btree (is_first_kill);


--
-- Name: idx_18498_idx_kill_events_killer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18498_idx_kill_events_killer ON public.kill_events USING btree (killer_id);


--
-- Name: idx_18498_idx_kill_events_round; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18498_idx_kill_events_round ON public.kill_events USING btree (round_id);


--
-- Name: idx_18498_idx_kill_events_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18498_idx_kill_events_time ON public.kill_events USING btree (round_id, game_time_ms);


--
-- Name: idx_18498_idx_kill_events_victim; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18498_idx_kill_events_victim ON public.kill_events USING btree (victim_id);


--
-- Name: idx_18512_idx_spike_events_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18512_idx_spike_events_player ON public.spike_events USING btree (player_id);


--
-- Name: idx_18512_idx_spike_events_round; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18512_idx_spike_events_round ON public.spike_events USING btree (round_id);


--
-- Name: idx_18512_idx_spike_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18512_idx_spike_events_type ON public.spike_events USING btree (event_type);


--
-- Name: idx_18519_idx_orb_events_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18519_idx_orb_events_player ON public.orb_events USING btree (player_id);


--
-- Name: idx_18519_idx_orb_events_round; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18519_idx_orb_events_round ON public.orb_events USING btree (round_id);


--
-- Name: idx_18526_idx_ability_events_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18526_idx_ability_events_name ON public.ability_events USING btree (ability_name);


--
-- Name: idx_18526_idx_ability_events_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18526_idx_ability_events_player ON public.ability_events USING btree (player_id);


--
-- Name: idx_18526_idx_ability_events_round; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18526_idx_ability_events_round ON public.ability_events USING btree (round_id);


--
-- Name: idx_18535_idx_kill_assists_assister; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18535_idx_kill_assists_assister ON public.kill_assists USING btree (assister_id);


--
-- Name: idx_18535_idx_kill_assists_round; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18535_idx_kill_assists_round ON public.kill_assists USING btree (round_id);


--
-- Name: idx_18543_idx_scenario_economy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18543_idx_scenario_economy ON public.scenario_index USING btree (attacker_economy, defender_economy);


--
-- Name: idx_18543_idx_scenario_full; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18543_idx_scenario_full ON public.scenario_index USING btree (attacker_alive, defender_alive, spike_planted, map_name);


--
-- Name: idx_18543_idx_scenario_game; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18543_idx_scenario_game ON public.scenario_index USING btree (game_id);


--
-- Name: idx_18543_idx_scenario_map; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18543_idx_scenario_map ON public.scenario_index USING btree (map_name);


--
-- Name: idx_18543_idx_scenario_outcome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18543_idx_scenario_outcome ON public.scenario_index USING btree (attacker_won);


--
-- Name: idx_18543_idx_scenario_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_18543_idx_scenario_state ON public.scenario_index USING btree (attacker_alive, defender_alive, spike_planted);


--
-- Name: ability_events ability_events_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ability_events
    ADD CONSTRAINT ability_events_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id);


--
-- Name: ability_events ability_events_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ability_events
    ADD CONSTRAINT ability_events_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.rounds(id);


--
-- Name: games games_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.series(id);


--
-- Name: games games_winner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.teams(id);


--
-- Name: kill_assists kill_assists_assister_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kill_assists
    ADD CONSTRAINT kill_assists_assister_id_fkey FOREIGN KEY (assister_id) REFERENCES public.players(id);


--
-- Name: kill_assists kill_assists_killer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kill_assists
    ADD CONSTRAINT kill_assists_killer_id_fkey FOREIGN KEY (killer_id) REFERENCES public.players(id);


--
-- Name: kill_assists kill_assists_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kill_assists
    ADD CONSTRAINT kill_assists_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.rounds(id);


--
-- Name: kill_events kill_events_killer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kill_events
    ADD CONSTRAINT kill_events_killer_id_fkey FOREIGN KEY (killer_id) REFERENCES public.players(id);


--
-- Name: kill_events kill_events_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kill_events
    ADD CONSTRAINT kill_events_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.rounds(id);


--
-- Name: kill_events kill_events_victim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kill_events
    ADD CONSTRAINT kill_events_victim_id_fkey FOREIGN KEY (victim_id) REFERENCES public.players(id);


--
-- Name: orb_events orb_events_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orb_events
    ADD CONSTRAINT orb_events_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id);


--
-- Name: orb_events orb_events_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orb_events
    ADD CONSTRAINT orb_events_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.rounds(id);


--
-- Name: player_round_stats player_round_stats_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_round_stats
    ADD CONSTRAINT player_round_stats_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id);


--
-- Name: player_round_stats player_round_stats_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_round_stats
    ADD CONSTRAINT player_round_stats_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.rounds(id);


--
-- Name: player_round_stats player_round_stats_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_round_stats
    ADD CONSTRAINT player_round_stats_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: players players_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: rounds rounds_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rounds
    ADD CONSTRAINT rounds_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id);


--
-- Name: rounds rounds_winning_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rounds
    ADD CONSTRAINT rounds_winning_team_id_fkey FOREIGN KEY (winning_team_id) REFERENCES public.teams(id);


--
-- Name: scenario_index scenario_index_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_index
    ADD CONSTRAINT scenario_index_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id);


--
-- Name: scenario_index scenario_index_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario_index
    ADD CONSTRAINT scenario_index_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.rounds(id);


--
-- Name: series series_team_a_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series
    ADD CONSTRAINT series_team_a_id_fkey FOREIGN KEY (team_a_id) REFERENCES public.teams(id);


--
-- Name: series series_team_b_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series
    ADD CONSTRAINT series_team_b_id_fkey FOREIGN KEY (team_b_id) REFERENCES public.teams(id);


--
-- Name: series series_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series
    ADD CONSTRAINT series_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id);


--
-- Name: series series_winner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series
    ADD CONSTRAINT series_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.teams(id);


--
-- Name: spike_events spike_events_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spike_events
    ADD CONSTRAINT spike_events_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id);


--
-- Name: spike_events spike_events_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spike_events
    ADD CONSTRAINT spike_events_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.rounds(id);


--
-- Name: tournaments tournaments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.tournaments(id);


--
-- PostgreSQL database dump complete
--

