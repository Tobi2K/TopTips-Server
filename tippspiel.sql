-- phpMyAdmin SQL Dump
-- version 5.1.0
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Sep 07, 2021 at 09:21 PM
-- Server version: 10.3.29-MariaDB-0+deb10u1
-- PHP Version: 7.3.29-1~deb10u1

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `tippspiel`
--

-- --------------------------------------------------------

--
-- Table structure for table `game`
--

CREATE TABLE `game` (
  `game_id` int(11) NOT NULL,
  `spieltag` int(11) NOT NULL,
  `date` date NOT NULL DEFAULT current_timestamp(),
  `team1_id` int(11) NOT NULL,
  `team2_id` int(11) NOT NULL,
  `special_bet_id` int(11) NOT NULL,
  `score_team1` int(11) NOT NULL DEFAULT 0,
  `score_team2` int(11) NOT NULL DEFAULT 0,
  `special_bet` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- --------------------------------------------------------

--
-- Table structure for table `guess`
--

CREATE TABLE `guess` (
  `guess_id` int(11) NOT NULL,
  `game_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `score_team1` int(11) NOT NULL,
  `score_team2` int(11) NOT NULL,
  `special_bet` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- --------------------------------------------------------

--
-- Table structure for table `special_bet`
--

CREATE TABLE `special_bet` (
  `bet_id` int(11) NOT NULL,
  `bet_desc` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `special_bet`
--

INSERT INTO `special_bet` (`bet_id`, `bet_desc`) VALUES
(0, '7m Würfe'),
(1, 'Gelbe Karten'),
(2, '2 Minuten'),
(3, 'Paraden'),
(4, 'Tempo-Tore'),
(5, 'Feldtore'),
(6, 'Steals'),
(7, 'Technische Fehler'),
(8, 'Wurfquote (in %)');

-- --------------------------------------------------------

--
-- Table structure for table `team`
--

CREATE TABLE `team` (
  `team_id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `team`
--

INSERT INTO `team` (`team_id`, `name`) VALUES
(0, 'Bergischer HC'),
(1, 'FRISCH AUF! Göppingen'),
(2, 'Füchse Berlin'),
(3, 'GWD Minden'),
(4, 'Handball Sport Verein Hamburg'),
(5, 'HBW Balingen-Weilstetten'),
(6, 'HC Erlangen'),
(7, 'HSG Wetzlar'),
(8, 'MT Melsungen'),
(9, 'Rhein-Neckar Löwen'),
(10, 'SC DHfK Leipzig'),
(11, 'SC Magdeburg'),
(12, 'SG Flensburg-Handewitt'),
(13, 'TBV Lemgo Lippe'),
(14, 'THW Kiel'),
(15, 'TSV Hannover-Burgdorf'),
(16, 'TuS N-Lübbecke'),
(17, 'TVB Stuttgart');

-- --------------------------------------------------------

--
-- Table structure for table `user`
--

CREATE TABLE `user` (
  `user_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `user`
--

INSERT INTO `user` (`user_id`, `name`, `password`) VALUES
(1, 'Tobi', 'test'),
(2, 'Sören', 'test'),
(3, 'Till', 'test');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `game`
--
ALTER TABLE `game`
  ADD PRIMARY KEY (`game_id`);

--
-- Indexes for table `guess`
--
ALTER TABLE `guess`
  ADD PRIMARY KEY (`guess_id`);

--
-- Indexes for table `special_bet`
--
ALTER TABLE `special_bet`
  ADD PRIMARY KEY (`bet_id`);

--
-- Indexes for table `team`
--
ALTER TABLE `team`
  ADD PRIMARY KEY (`team_id`);

--
-- Indexes for table `user`
--
ALTER TABLE `user`
  ADD PRIMARY KEY (`user_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `game`
--
ALTER TABLE `game`
  MODIFY `game_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=32;

--
-- AUTO_INCREMENT for table `guess`
--
ALTER TABLE `guess`
  MODIFY `guess_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `special_bet`
--
ALTER TABLE `special_bet`
  MODIFY `bet_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `team`
--
ALTER TABLE `team`
  MODIFY `team_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `user`
--
ALTER TABLE `user`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
