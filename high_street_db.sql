-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Sep 13, 2026 at 12:37 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `high_street_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `admin_sessions`
--

CREATE TABLE `admin_sessions` (
  `session_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `refresh_token_hash` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `admin_sessions`
--

INSERT INTO `admin_sessions` (`session_id`, `user_id`, `refresh_token_hash`, `expires_at`, `revoked_at`, `ip_address`, `user_agent`, `created_at`) VALUES
(1, 1, '31e31adbb3df4905afbfc45269c80c07ac9f77a2dcbad6eaf62e9dbe687fcc79', '2026-09-19 11:17:43', NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 11:17:43'),
(2, 1, '86d1093ba0bc809b6db2584eafd158fa0e11bca809fb352721087b543e7698d9', '2026-09-19 11:22:41', NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 11:22:41'),
(3, 2, 'b486243265f8161d5e6d9bf30eadee5c121752c1c0a21452c72fde22e09a8e43', '2026-09-19 12:04:33', NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 12:04:33'),
(4, 3, '19cf32d2d46a5fe46991d56ec8dc11b9c7f9c070f62b787365ab196f24ea87bd', '2026-09-19 13:30:08', NULL, '::1', 'Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168', '2026-09-12 13:30:08'),
(5, 4, '753f772968f048826000012f3ff1fcd36775d9117a36660a8b1963693af3f994', '2026-09-19 13:31:05', NULL, '::1', 'Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9168', '2026-09-12 13:31:05'),
(6, 5, 'ce3c623e1dfcb55bfd3b280699a840bad13a509b5f95de0086498000f1c7dacf', '2026-09-19 13:57:48', '2026-09-12 13:58:08', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 13:57:48'),
(7, 1, '00b54151e34ae12ae3a9b3d5d741f8f7a1767d9d535c2cb882f1250d2551019b', '2026-09-19 13:58:26', '2026-09-12 13:58:56', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 13:58:26'),
(8, 2, '08c73421ecad7394d6c8375ac1924c5ef6511aa9320ba37320175ba6cf21a77a', '2026-09-19 13:59:06', NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 13:59:06'),
(9, 5, '3a860af3d8c1f1ce216f4a09e71f1e7f9fc41ce3a53469b5f38a151cea7a79e6', '2026-09-19 14:09:06', '2026-09-12 14:09:10', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 14:09:06'),
(10, 1, '68f4cb7b7bb377319b43bc177f97b59024e2cdbede51c6cde195f5c117d0654b', '2026-09-19 14:10:21', '2026-09-12 14:11:03', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 14:10:21'),
(11, 1, 'dec04d32bfdad5cd0b3820187adfa0961f8372216ef508199810325a1031ed94', '2026-09-19 14:16:49', '2026-09-12 14:17:06', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 14:16:49'),
(12, 2, '292b94b13487418d0ed38798a18e01ea9123fe232945c138125b557c57c60acf', '2026-09-19 14:17:22', '2026-09-12 14:17:33', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 14:17:22'),
(13, 1, '47bea32b3e9476e15ea4b8c5d1ff106e4107f76830bd989efd904553c469186d', '2026-09-19 14:18:16', '2026-09-12 14:18:32', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 14:18:16'),
(14, 1, '0a7b153338a61176ae5c7fe6e26309729bf62f361fb3894844d72825d4423b85', '2026-09-19 14:19:11', '2026-09-12 14:32:54', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 14:19:11'),
(15, 2, '678263f16b99fd4509f96a90c8c3d24f3ee115c6697ac55c86908c48cb703dee', '2026-09-19 14:33:04', '2026-09-12 14:34:04', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 14:33:04'),
(16, 1, '26d2a1a7e88f14f20a31429a9de92889307b23db3932dde99da34dc8a8be334e', '2026-09-19 14:34:13', '2026-09-12 14:45:57', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 14:34:13'),
(17, 5, '0e935649d597f908c46d108f2db6328d48ad05af90ef58b4c68fda9861741dcf', '2026-09-19 14:46:14', '2026-09-12 14:48:58', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 14:46:14'),
(18, 2, 'f64435de3071bbc45fbddc0a402f8d37e149ecc4018a4919eaafbb54fe8529ce', '2026-09-19 14:49:12', NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 14:49:12'),
(19, 5, '0d9a69ff7d69d1d6379c7e50c4c65e516e98bb5dc2be77b34c177dc615381f1a', '2026-09-19 14:58:54', '2026-09-12 14:59:34', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 14:58:54'),
(20, 2, '9754eb94ead0216575ab647805bf8964ea22f58c42b055072f8c85690d36327a', '2026-09-19 14:59:48', NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 14:59:48'),
(21, 5, 'c95133d7117717ce42fc7aac9f7a278b5a92052614e8b9841c9c2b9a9e70b391', '2026-09-19 15:04:57', NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 15:04:57'),
(22, 5, 'b5e127638b606e915e7dd28b6e7532f67ee596431da04705f9837528b19d11f5', '2026-09-19 15:16:48', NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 15:16:48'),
(23, 5, '93bb01795ec6ff10b0bb033524916c899b062e9693f6ad5bb9abe7e169937705', '2026-09-19 15:33:41', NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 15:33:41'),
(24, 1, '0b7dd628547e2cf5988886e8088134ba6832d4e2f04295c4476c9c12cd033b05', '2026-09-19 16:23:52', '2026-09-12 16:24:36', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 16:23:52'),
(25, 2, '8fe1fe25404d33ecfdd697613f22ef15810066094be276b5a944efc1a7240a00', '2026-09-19 16:24:54', '2026-09-12 16:25:20', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 16:24:54'),
(26, 5, '700a7330db14e605ff44ea601a018caffbc19c0ec85086e936c172e7a650265a', '2026-09-19 16:25:47', NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 16:25:47'),
(27, 5, '71384909df67e80ca12a798a7f6e0608b00f9ea74ad24bc7d49083a16df07866', '2026-09-19 16:45:42', '2026-09-12 16:48:55', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 16:45:42'),
(28, 5, '9866c349d461de6112d4be3e7ed619925cb51d7769056b1bdd8e42d7a888cc5b', '2026-09-19 16:49:06', '2026-09-12 16:49:51', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 16:49:06'),
(29, 1, '1a5d37bd65a3622f5678730239f6b8ae596f7d1ee772b1d95dc991611936c5ff', '2026-09-19 16:50:12', '2026-09-12 16:50:56', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 16:50:12'),
(30, 5, '61c8d8419c30dc706b06f518d901df7c794ed72bb953c896295fbea8a1f64391', '2026-09-19 16:51:05', '2026-09-12 17:03:29', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 16:51:05'),
(31, 1, '8c2c20bcef8772107ed53c2c77a0dbcb3c8dcd9e0cb2e0d42aee74f6aaedb9f9', '2026-09-19 17:03:46', '2026-09-12 17:04:26', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 17:03:46'),
(32, 2, '47d531b935a4847168f76e776fd63b4899ffb0b68b0d5847705b2ff91ee73045', '2026-09-19 17:04:42', NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 17:04:42'),
(33, 5, '228ac426b83fb93efe1a91285186daf35dc7f56c8c329300e96b585cb4c43780', '2026-09-19 17:44:35', NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 17:44:35'),
(34, 5, 'a87c9380738e63397dc45a1c42ced01432da4c972056d257f38169bb5554fc0b', '2026-09-19 17:54:03', '2026-09-12 18:04:59', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 17:54:03'),
(35, 1, '04f2fa36891e8ad2ebbb846cec6f8ac7e1a8855b1385e4d12ae1f98c80ca9436', '2026-09-19 18:05:16', '2026-09-12 18:06:58', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 18:05:16'),
(36, 5, 'e3725e78e3c74eca5262d6b494132eab5c4bf6f071387f772d1bed5fc949b7ac', '2026-09-19 18:07:07', '2026-09-12 18:08:08', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 18:07:07'),
(37, 1, '93e7284bf13a98df83ef91380de1452ee509387f9bdb34f0ebc0aa2269e01667', '2026-09-19 18:08:20', '2026-09-12 18:09:38', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 18:08:20'),
(38, 5, '440d2d12671b5029f53772555685e351c067e29fff67df82e69a08a8cf7db4fd', '2026-09-19 18:09:47', '2026-09-12 18:10:16', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 18:09:47'),
(39, 2, '09d6136ca89b1cc4832066f3975ade27e524bccd4393ffabaac713ea491f74bc', '2026-09-19 18:10:32', '2026-09-12 18:19:03', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 18:10:32'),
(40, 2, '1d4e0466beaf4a644998b442bf9bb14d64cd55dc12a4175d97594b7b74339dc5', '2026-09-19 18:19:17', '2026-09-12 18:27:33', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 18:19:17'),
(41, 2, '019a07e52ca1e59c47c67768d4cd675952f1f2059c9ccdc5c63213fa3711dab4', '2026-09-19 18:27:49', '2026-09-12 18:30:01', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 18:27:49'),
(42, 5, 'e9696b23cc5e51265e0c25930d730e109edb4b43ba13cf5ddd3493156aa870f0', '2026-09-19 18:30:10', '2026-09-12 18:36:41', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 18:30:10'),
(43, 1, 'd8dde71474c58930e44da7ad191682f81f2eb007bb3e27023d4733e3c177fd19', '2026-09-19 18:37:00', '2026-09-12 18:37:49', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 18:37:00'),
(44, 2, 'df120e5dc1d0ba5a1e85cc8e1b6546c8fb8969b35169f402bb8586caa1fd6656', '2026-09-19 18:38:01', '2026-09-12 18:44:29', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 18:38:01'),
(45, 1, '0391c37ade5df0a01ca77c52f180eb2c4fa4ce2502bd96417aac8c8031935cc0', '2026-09-19 18:44:42', '2026-09-12 18:45:04', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 18:44:42'),
(46, 2, '7d301b4d785802baad7160d93d430cde0de4fc625ae83fa522706549ff710c9b', '2026-09-19 18:45:21', NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 18:45:21'),
(47, 2, '13bae968bff7fbef1d70e2bf0993231aea7aaa5bff0291cd6f663f1411194319', '2026-09-19 18:50:31', '2026-09-12 18:50:49', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 18:50:31'),
(48, 1, 'e20d29d98b1cb6d169c51a44745f8f7aa6e3bcebf59813addbad942801b521f1', '2026-09-19 18:51:02', '2026-09-12 18:51:28', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 18:51:02'),
(49, 2, '08e3b0c4646329f14d54fbf1b7ab1c60d7a402eaf82d4d4ee2136a46fdbde6fd', '2026-09-19 18:51:44', '2026-09-12 19:03:32', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 18:51:44'),
(50, 1, '5b5b3d4d3d7375abe935cf8cc0a8e3a51f37ff19578698dfebadf06123c286f8', '2026-09-19 19:03:46', '2026-09-12 19:03:57', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 19:03:46'),
(51, 2, 'f50f6c3833e9f8c4f126f10b480e44ec1a110ac1d6419bb5fdbbee7474b7b642', '2026-09-19 19:04:13', '2026-09-12 19:05:00', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 19:04:13'),
(52, 1, 'cedba1b89c5e837866be10e3508d15639ea4565aa41f884560629479e92c4879', '2026-09-19 19:05:11', '2026-09-12 19:05:28', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 19:05:11'),
(53, 2, '73f8f3e8136017435fbf1fb56e7f11630984304a7ab7eb807b5fc4c3622d1795', '2026-09-19 19:05:44', '2026-09-12 19:14:25', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 19:05:44'),
(54, 1, 'b342f031eb3fe6204b2904188245a2c105e6d7277645e0875e789b980659fda4', '2026-09-19 19:14:40', '2026-09-12 19:16:07', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 19:14:40'),
(55, 5, 'ae37f14817cfa60355eb2912560b7217d0cb72f81d9085adc3b80b3ab47a3613', '2026-09-19 19:16:18', '2026-09-12 19:27:41', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 19:16:18'),
(56, 1, '186046d5a24d9d04f680f90bbe8e15f59359e2fb35f7d9d78263a94fdc9586c5', '2026-09-19 19:27:53', '2026-09-12 19:29:51', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 19:27:53'),
(57, 5, '5e4fea0eee931dc57fc68407af3b224750ddc04649d11ba2d2da6bb90db73263', '2026-09-19 19:30:09', '2026-09-12 19:30:42', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 19:30:09'),
(58, 2, 'fc0340becadd46f5ff2fbd050974d44b47b13ff85bc21f8433b50a4248e0b321', '2026-09-19 19:30:53', NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-12 19:30:53'),
(59, 5, '16d285fe94396f6e19996de15881781e8b53371c4925f2c551596241bd2d3016', '2026-09-20 05:49:18', '2026-09-13 05:49:24', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-13 05:49:18'),
(60, 1, '0f438392c68a53cdf5483365614c18dc11f7d67332da1a1aadbd7098d733c218', '2026-09-20 05:49:39', '2026-09-13 05:50:25', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-13 05:49:39'),
(61, 5, '749493899dc5309e8ae88aeb1f51c69231d40c4c3f20c71d19c5eb7705f4435a', '2026-09-20 05:50:39', '2026-09-13 05:50:59', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-13 05:50:39'),
(62, 1, 'e5a6cb8c65560432c9265213a3682882fe7db1de099fcc1bdef09d799dc5b75a', '2026-09-20 06:11:10', NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-13 06:11:10'),
(63, 1, 'fb2942c9ffaae408129057b08887ba179fc7f66dfbccd824f1112a40714ad37b', '2026-09-20 06:33:42', '2026-09-13 06:35:26', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-13 06:33:42'),
(64, 5, 'a6a87c7ca0f38a66875bca87cd3f0d295492f911faa6f0520d57e721aa4ddfac', '2026-09-20 06:35:37', '2026-09-13 06:35:56', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-13 06:35:37'),
(65, 1, 'b290d6bb7fa84beb879032029d64f72110d68cba3bd876519b37410cd0adbd40', '2026-09-20 06:36:09', '2026-09-13 06:36:20', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-13 06:36:09'),
(66, 5, '612ce2ddae452cf92176ac5dd534c6354ac100355100d0c40f607f70748be78a', '2026-09-20 06:36:30', NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-13 06:36:30'),
(67, 5, '59a34054f7b3650748bf39a8c92e3032795ec08a3d9e5369cd244cc3e4b5b306', '2026-09-20 09:28:31', '2026-09-13 09:28:37', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-13 09:28:31'),
(68, 1, '900bf51e544bc7fdab368c5138794105a544a0946f8993700e8e1a227b17ea0e', '2026-09-20 09:28:55', NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-13 09:28:55'),
(69, 1, '184bb8cde9eb890fa5b96604d72b5b715bfc10f4503aea3dbb986dc4d92768f4', '2026-09-20 09:47:08', NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-13 09:47:08'),
(70, 1, '8d0a570d53d67cd559ba2d15aa219856ff1103f256455dc51c86827a2a24affe', '2026-09-20 10:07:52', NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-13 10:07:52'),
(71, 5, '0941545a138edadbb599aa4c9f817bf3ee8c3c00cd20220d78448b51f36f95eb', '2026-09-20 10:26:52', NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', '2026-09-13 10:26:52');

-- --------------------------------------------------------

--
-- Table structure for table `company_content`
--

CREATE TABLE `company_content` (
  `content_id` int(11) NOT NULL,
  `section_slug` varchar(80) NOT NULL,
  `title` varchar(180) NOT NULL,
  `body` text NOT NULL,
  `image_url` varchar(500) DEFAULT NULL,
  `display_order` int(11) DEFAULT 0,
  `is_published` tinyint(1) DEFAULT 0,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `company_content`
--

INSERT INTO `company_content` (`content_id`, `section_slug`, `title`, `body`, `image_url`, `display_order`, `is_published`, `created_at`, `updated_at`) VALUES
(1, 'about', 'Our story', 'High Street (PVT) Ltd. is a vehicle dealership in Katugastota, Kandy, focused on carefully selected vehicles and straightforward customer service.', NULL, 0, 1, '2026-09-12 11:09:03', '2026-09-12 11:09:03'),
(2, 'services', 'Our services', 'Vehicle sales, sourcing and import guidance, valuation support, and clear financing guidance.', NULL, 1, 1, '2026-09-12 11:09:03', '2026-09-12 11:09:03'),
(3, 'faq', 'Frequently asked questions', 'Viewing appointments are recommended. Every listing shows its current showroom status. Finance figures are illustrative only.', NULL, 2, 1, '2026-09-12 11:09:03', '2026-09-12 11:09:03'),
(4, 'contact', 'Visit High Street', 'Katugastota, Kandy, Sri Lanka|+947712345625|info@highstreet.lk|Mon-Sat 9:00-18:00', '', 3, 1, '2026-09-12 11:09:03', '2026-09-13 09:58:58'),
(5, 'showroom', 'The showroom', 'Explore curated vehicles in a calm, professional showroom environment.', NULL, 4, 1, '2026-09-12 11:09:03', '2026-09-12 11:09:03');

-- --------------------------------------------------------

--
-- Table structure for table `enquiries`
--

CREATE TABLE `enquiries` (
  `enquiry_id` int(11) NOT NULL,
  `vehicle_id` int(11) DEFAULT NULL,
  `vehicle_reference` varchar(180) NOT NULL,
  `customer_name` varchar(100) NOT NULL,
  `customer_email` varchar(150) NOT NULL,
  `customer_phone` varchar(30) NOT NULL,
  `message` text NOT NULL,
  `status` enum('New','In Progress','Responded','Archived') DEFAULT 'New',
  `responded_at` datetime DEFAULT NULL,
  `responded_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `assigned_to` int(11) DEFAULT NULL,
  `assigned_at` datetime DEFAULT NULL,
  `assigned_by` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `enquiries`
--

INSERT INTO `enquiries` (`enquiry_id`, `vehicle_id`, `vehicle_reference`, `customer_name`, `customer_email`, `customer_phone`, `message`, `status`, `responded_at`, `responded_by`, `created_at`, `updated_at`, `customer_id`, `assigned_to`, `assigned_at`, `assigned_by`) VALUES
(1, 1, '2022 Toyota Land Cruiser Prado', 'Nimal Perera', 'customer1@example.com', '0771234500', 'I would like to confirm availability and arrange a showroom viewing.', 'Responded', '2026-09-12 11:09:03', 1, '2026-09-12 11:09:03', '2026-09-12 11:09:03', NULL, NULL, NULL, NULL),
(2, 2, '2021 BMW 520d M Sport', 'Kamal Silva', 'customer2@example.com', '0771234501', 'I would like to confirm availability and arrange a showroom viewing.', 'Responded', '2026-09-12 11:09:03', 1, '2026-09-12 10:09:03', '2026-09-12 11:09:03', NULL, NULL, NULL, NULL),
(3, 3, '2023 Honda Vezel Z', 'Ayesha Fernando', 'customer3@example.com', '0771234502', 'I would like to confirm availability and arrange a showroom viewing.', 'In Progress', NULL, NULL, '2026-09-12 09:09:03', '2026-09-12 11:09:03', NULL, NULL, NULL, NULL),
(4, 4, '2020 Toyota Aqua S', 'Ravi Kumar', 'customer4@example.com', '0771234503', 'I would like to confirm availability and arrange a showroom viewing.', 'In Progress', NULL, NULL, '2026-09-12 08:09:03', '2026-09-12 11:09:03', NULL, NULL, NULL, NULL),
(5, 5, '2022 Mercedes-Benz C200 AMG', 'Ishara Jayasinghe', 'customer5@example.com', '0771234504', 'I would like to confirm availability and arrange a showroom viewing.', 'New', NULL, NULL, '2026-09-12 07:09:03', '2026-09-12 11:09:03', NULL, NULL, NULL, NULL),
(6, 6, '2021 Suzuki Wagon R Stingray', 'Fathima Rizna', 'customer6@example.com', '0771234505', 'I would like to confirm availability and arrange a showroom viewing.', 'New', NULL, NULL, '2026-09-12 06:09:03', '2026-09-12 11:09:03', NULL, NULL, NULL, NULL),
(7, 7, '2019 Toyota Hiace Super GL', 'Chamara Bandara', 'customer7@example.com', '0771234506', 'I would like to confirm availability and arrange a showroom viewing.', 'New', NULL, NULL, '2026-09-12 05:09:03', '2026-09-12 11:09:03', NULL, NULL, NULL, NULL),
(8, 8, '2019 Honda Civic RS', 'Dulani Peiris', 'customer8@example.com', '0771234507', 'I would like to confirm availability and arrange a showroom viewing.', 'New', NULL, NULL, '2026-09-12 04:09:03', '2026-09-12 11:09:03', NULL, NULL, NULL, NULL),
(9, NULL, 'General enquiry', 'Amri', 'amrirasool05@gmail.com', '0778389933', 'I need a Defender P400 2026', 'New', NULL, NULL, '2026-09-12 11:22:16', '2026-09-12 11:22:16', NULL, NULL, NULL, NULL),
(10, 2, '2021 BMW 520d M Sport', 'Amri', 'amrirasool05@gmail.com', '0778389933', 'Can I get more details and Images of this vehicle', 'New', NULL, NULL, '2026-09-12 11:48:54', '2026-09-12 11:48:54', NULL, NULL, NULL, NULL),
(11, 2, '2021 BMW 520d M Sport', 'Amri', 'amrirasool05@gmail.com', '0778389933', 'Can I get more details and Images of this vehicle', 'New', NULL, NULL, '2026-09-12 11:49:02', '2026-09-12 11:49:02', NULL, NULL, NULL, NULL),
(12, 2, '2021 BMW 520d M Sport', 'Amri', 'amrirasool05@gmail.com', '0778389933', 'Can i get more details and Images about this car?', 'New', NULL, NULL, '2026-09-12 11:52:09', '2026-09-12 11:52:09', NULL, NULL, NULL, NULL),
(13, 2, '2021 BMW 520d M Sport', 'Amri', 'amrirasool05@gmail.com', '0778389933', 'Can i get more details and Images about this car?', 'New', NULL, NULL, '2026-09-12 12:02:13', '2026-09-12 12:02:13', NULL, NULL, NULL, NULL),
(14, 1, '2022 Toyota Land Cruiser Prado', 'Amri', 'amrirasool05@gmail.com', '0778389933', 'I need full inspection report of this car', 'Responded', '2026-09-12 19:31:17', 2, '2026-09-12 14:47:05', '2026-09-12 19:31:17', 5, 2, '2026-09-12 20:18:40', 1),
(15, 1, '2022 Toyota Land Cruiser Prado', 'Amri', 'amrirasool05@gmail.com', '0778389933', 'uisbdwbdwudbwdwubudwjbwu', 'New', NULL, NULL, '2026-09-12 16:25:59', '2026-09-12 16:25:59', 5, NULL, NULL, NULL),
(16, 4, '2020 Toyota Aqua S', 'Amri', 'amrirasool05@gmail.com', '0778389933', 'I need a full inspection report', 'New', NULL, NULL, '2026-09-12 19:16:54', '2026-09-12 19:16:54', 5, NULL, NULL, NULL),
(17, 4, '2020 Toyota Aqua S', 'Amri', 'amrirasool05@gmail.com', '0778389933', 'I need a full inspection report', 'New', NULL, NULL, '2026-09-12 19:17:02', '2026-09-12 19:17:02', 5, NULL, NULL, NULL),
(18, 4, '2020 Toyota Aqua S', 'Amri', 'amrirasool05@gmail.com', '0778389933', 'I need a full inspection report', 'New', NULL, NULL, '2026-09-12 19:17:12', '2026-09-12 19:17:12', 5, NULL, NULL, NULL),
(19, 4, '2020 Toyota Aqua S', 'Amri', 'amrirasool05@gmail.com', '0778389933', 'I need a full inspection report', 'New', NULL, NULL, '2026-09-12 19:18:16', '2026-09-12 19:18:16', 5, NULL, NULL, NULL),
(20, 4, '2020 Toyota Aqua S', 'Amri', 'amrirasool05@gmail.com', '0778389933', 'I need a full indpection report', 'Responded', '2026-09-12 19:29:39', 1, '2026-09-12 19:26:51', '2026-09-12 19:29:39', 5, NULL, NULL, NULL),
(21, 1, '2022 Toyota Land Cruiser Prado', 'Amri', 'amrirasool05@gmail.com', '0778389933', 'I need to inspect this vehicle', 'New', NULL, NULL, '2026-09-13 10:27:12', '2026-09-13 10:27:12', 5, NULL, NULL, NULL),
(22, 1, '2022 Toyota Land Cruiser Prado', 'Amri', 'amrirasool05@gmail.com', '0778389933', 'I need to inspect this vehicle', 'New', NULL, NULL, '2026-09-13 10:28:58', '2026-09-13 10:28:58', 5, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `enquiry_responses`
--

CREATE TABLE `enquiry_responses` (
  `response_id` int(11) NOT NULL,
  `enquiry_id` int(11) NOT NULL,
  `admin_id` int(11) NOT NULL,
  `subject` varchar(180) NOT NULL,
  `response_body` text NOT NULL,
  `status` enum('Draft','Sent') DEFAULT 'Draft',
  `sent_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `enquiry_responses`
--

INSERT INTO `enquiry_responses` (`response_id`, `enquiry_id`, `admin_id`, `subject`, `response_body`, `status`, `sent_at`, `created_at`, `updated_at`) VALUES
(1, 20, 1, 'Booking', 'Bring your Driving License', 'Sent', '2026-09-12 19:29:39', '2026-09-12 19:29:27', '2026-09-12 19:29:39');

-- --------------------------------------------------------

--
-- Table structure for table `financing_configs`
--

CREATE TABLE `financing_configs` (
  `config_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `annual_interest_rate` decimal(6,3) NOT NULL,
  `min_down_payment_pct` decimal(5,2) NOT NULL,
  `max_loan_term_months` int(11) NOT NULL,
  `is_active` tinyint(1) DEFAULT 0,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `financing_configs`
--

INSERT INTO `financing_configs` (`config_id`, `name`, `annual_interest_rate`, `min_down_payment_pct`, `max_loan_term_months`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Standard illustrative plan', 12.500, 20.00, 60, 1, '2026-09-12 11:09:03', '2026-09-12 11:09:03');

-- --------------------------------------------------------

--
-- Table structure for table `sequelizemeta`
--

CREATE TABLE `sequelizemeta` (
  `name` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

--
-- Dumping data for table `sequelizemeta`
--

INSERT INTO `sequelizemeta` (`name`) VALUES
('202609120001-create-schema.cjs'),
('202609130001-add-customer-role-and-profile.cjs'),
('202609130002-add-staff-permissions-and-enquiry-assignments.cjs'),
('202609130003-create-wishlists.cjs'),
('202609130004-create-test-drive-bookings.cjs');

-- --------------------------------------------------------

--
-- Table structure for table `staff_permissions`
--

CREATE TABLE `staff_permissions` (
  `permission_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `can_manage_inventory` tinyint(1) NOT NULL DEFAULT 0,
  `can_manage_enquiries` tinyint(1) NOT NULL DEFAULT 0,
  `can_view_assigned_contacts` tinyint(1) NOT NULL DEFAULT 0,
  `can_archive_records` tinyint(1) NOT NULL DEFAULT 0,
  `can_view_limited_analytics` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `staff_permissions`
--

INSERT INTO `staff_permissions` (`permission_id`, `user_id`, `can_manage_inventory`, `can_manage_enquiries`, `can_view_assigned_contacts`, `can_archive_records`, `can_view_limited_analytics`, `created_at`, `updated_at`) VALUES
(1, 2, 0, 1, 1, 1, 1, '2026-09-12 19:50:34', '2026-09-12 19:05:24');

-- --------------------------------------------------------

--
-- Table structure for table `test_drive_bookings`
--

CREATE TABLE `test_drive_bookings` (
  `booking_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `vehicle_id` int(11) DEFAULT NULL,
  `vehicle_reference` varchar(180) NOT NULL,
  `preferred_date` date NOT NULL,
  `preferred_time` time NOT NULL,
  `customer_note` text DEFAULT NULL,
  `staff_note` text DEFAULT NULL,
  `status` enum('Pending','Confirmed','Completed','Cancelled') NOT NULL DEFAULT 'Pending',
  `assigned_to` int(11) DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `test_drive_bookings`
--

INSERT INTO `test_drive_bookings` (`booking_id`, `customer_id`, `vehicle_id`, `vehicle_reference`, `preferred_date`, `preferred_time`, `customer_note`, `staff_note`, `status`, `assigned_to`, `confirmed_at`, `completed_at`, `cancelled_at`, `created_at`, `updated_at`) VALUES
(1, 5, 1, '2022 Toyota Land Cruiser Prado', '2026-09-25', '10:00:00', 'I need to get an idea about this car', NULL, 'Cancelled', NULL, NULL, NULL, '2026-09-12 17:54:30', '2026-09-12 17:45:26', '2026-09-12 17:54:30'),
(2, 5, 2, '2021 BMW 520d M Sport', '2026-09-25', '12:00:00', 'I need inspect this vehicle', 'Your test drive is confirmed. Please bring your driving licence.', 'Completed', 2, '2026-09-12 18:09:27', '2026-09-12 18:11:35', NULL, '2026-09-12 18:07:53', '2026-09-12 18:11:35');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('Admin','Staff','Customer') NOT NULL DEFAULT 'Customer',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `address` varchar(500) DEFAULT NULL,
  `profile_image_url` varchar(500) DEFAULT NULL,
  `email_verified_at` datetime DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `name`, `email`, `password_hash`, `role`, `is_active`, `created_at`, `updated_at`, `phone`, `address`, `profile_image_url`, `email_verified_at`, `last_login_at`) VALUES
(1, 'Mr. Mudashir', 'admin@highstreet.lk', '$2b$12$X9luQwNcUicW8hY8QES7Ku9XESq4Kqq7bnkgj.B.DhN/crlsCUcNy', 'Admin', 1, '2026-09-12 11:09:03', '2026-09-13 10:07:52', NULL, NULL, NULL, NULL, '2026-09-13 10:07:52'),
(2, 'M.R.M. Amri', 'staff@highstreet.lk', '$2b$12$08NvHX5OB2cJWoRCIDjLpO0Mf0VHgC7ODhRtv2NBMdq2.Jx4ZxWYW', 'Staff', 1, '2026-09-12 11:09:03', '2026-09-12 19:30:53', NULL, NULL, NULL, NULL, '2026-09-12 19:30:53'),
(3, 'Test Customer', 'customer@highstreet.lk', '$2b$12$8i9GFO/Jk0U39MjQb1Io.O5uvsRWFYeijsQVEdqmRMHgjdIjh31z6', 'Customer', 1, '2026-09-12 13:30:08', '2026-09-12 13:30:08', '0771234567', 'Kandy, Sri Lanka', NULL, NULL, NULL),
(4, 'Unsafe Test', 'unsafe@highstreet.lk', '$2b$12$buJOpSLPFPuZFGPmqbRSEOLFtlGTTl5tDehujET668tK8bwJupFKq', 'Customer', 1, '2026-09-12 13:31:05', '2026-09-12 13:31:05', '0777654321', NULL, NULL, NULL, NULL),
(5, 'Amri', 'amrirasool05@gmail.com', '$2b$12$7WJkpOZHet725DjjzB53q.26N/lXonrIut5d7A6d1GzTKLq0XRKh2', 'Customer', 1, '2026-09-12 13:57:48', '2026-09-13 10:26:52', '0778389933', 'Kurunegala', NULL, NULL, '2026-09-13 10:26:52');

-- --------------------------------------------------------

--
-- Table structure for table `vehicles`
--

CREATE TABLE `vehicles` (
  `vehicle_id` int(11) NOT NULL,
  `make` varchar(50) NOT NULL,
  `model` varchar(50) NOT NULL,
  `year` int(11) NOT NULL,
  `price` decimal(14,2) NOT NULL,
  `mileage` int(11) DEFAULT 0,
  `condition` enum('New','Used','Reconditioned') NOT NULL,
  `type` varchar(50) NOT NULL,
  `fuel_type` varchar(30) NOT NULL,
  `transmission` varchar(30) NOT NULL,
  `engine_capacity` varchar(30) DEFAULT NULL,
  `color` varchar(40) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `status` enum('Draft','Available','Sold','Archived') DEFAULT 'Draft',
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `vehicles`
--

INSERT INTO `vehicles` (`vehicle_id`, `make`, `model`, `year`, `price`, `mileage`, `condition`, `type`, `fuel_type`, `transmission`, `engine_capacity`, `color`, `description`, `status`, `created_by`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'Toyota', 'Land Cruiser Prado', 2022, 34500000.00, 18000, 'Used', 'SUV', 'Diesel', 'Automatic', '2800cc', 'Pearl White', 'Carefully selected 2022 Toyota Land Cruiser Prado with verified specifications and showroom inspection. Contact High Street to arrange a viewing.', 'Available', 1, '2026-09-12 11:09:03', '2026-09-12 11:09:03', NULL),
(2, 'BMW', '520d M Sport', 2021, 29800000.00, 24000, 'Used', 'Luxury', 'Diesel', 'Automatic', '2000cc', 'Black', 'Carefully selected 2021 BMW 520d M Sport with verified specifications and showroom inspection. Contact High Street to arrange a viewing.', 'Sold', 1, '2026-09-11 11:09:03', '2026-09-13 05:50:09', NULL),
(3, 'Honda', 'Vezel Z', 2023, 21800000.00, 9000, 'Reconditioned', 'SUV', 'Hybrid', 'Automatic', '1500cc', 'Silver', 'Carefully selected 2023 Honda Vezel Z with verified specifications and showroom inspection. Contact High Street to arrange a viewing.', 'Available', 1, '2026-09-10 11:09:03', '2026-09-12 11:09:03', NULL),
(4, 'Toyota', 'Aqua S', 2020, 8950000.00, 38000, 'Used', 'Hatchback', 'Hybrid', 'Automatic', '1500cc', 'Blue', 'Carefully selected 2020 Toyota Aqua S with verified specifications and showroom inspection. Contact High Street to arrange a viewing.', 'Available', 1, '2026-09-09 11:09:03', '2026-09-12 11:09:03', NULL),
(5, 'Mercedes-Benz', 'C200 AMG', 2022, 32500000.00, 14000, 'Used', 'Luxury', 'Petrol', 'Automatic', '1500cc', 'Graphite', 'Carefully selected 2022 Mercedes-Benz C200 AMG with verified specifications and showroom inspection. Contact High Street to arrange a viewing.', 'Available', 1, '2026-09-08 11:09:03', '2026-09-12 11:09:03', NULL),
(6, 'Suzuki', 'Wagon R Stingray', 2021, 8750000.00, 22000, 'Reconditioned', 'Hatchback', 'Hybrid', 'Automatic', '660cc', 'White', 'Carefully selected 2021 Suzuki Wagon R Stingray with verified specifications and showroom inspection. Contact High Street to arrange a viewing.', 'Available', 1, '2026-09-07 11:09:03', '2026-09-12 11:09:03', NULL),
(7, 'Toyota', 'Hiace Super GL', 2019, 24500000.00, 68000, 'Used', 'Van', 'Diesel', 'Automatic', '2800cc', 'Black', 'Carefully selected 2019 Toyota Hiace Super GL with verified specifications and showroom inspection. Contact High Street to arrange a viewing.', 'Available', 1, '2026-09-06 11:09:03', '2026-09-12 11:09:03', NULL),
(8, 'Honda', 'Civic RS', 2019, 16200000.00, 41000, 'Used', 'Sedan', 'Petrol', 'Automatic', '1500cc', 'Red', 'Carefully selected 2019 Honda Civic RS with verified specifications and showroom inspection. Contact High Street to arrange a viewing.', 'Available', 1, '2026-09-05 11:09:03', '2026-09-12 11:09:03', NULL),
(9, 'Nissan', 'X-Trail', 2020, 17400000.00, 35000, 'Used', 'SUV', 'Hybrid', 'Automatic', '2000cc', 'Pearl White', 'Carefully selected 2020 Nissan X-Trail with verified specifications and showroom inspection. Contact High Street to arrange a viewing.', 'Available', 1, '2026-09-04 11:09:03', '2026-09-12 11:09:03', NULL),
(10, 'Mazda', 'Axela', 2018, 11200000.00, 52000, 'Used', 'Sedan', 'Petrol', 'Automatic', '1500cc', 'Soul Red', 'Carefully selected 2018 Mazda Axela with verified specifications and showroom inspection. Contact High Street to arrange a viewing.', 'Archived', 1, '2026-09-03 11:09:03', '2026-09-12 12:10:58', '2026-09-12 12:10:58'),
(11, 'Toyota', 'Corolla Cross', 2024, 26500000.00, 4000, 'New', 'SUV', 'Hybrid', 'Automatic', '1800cc', 'Silver', 'Carefully selected 2024 Toyota Corolla Cross with verified specifications and showroom inspection. Contact High Street to arrange a viewing.', 'Available', 1, '2026-09-02 11:09:03', '2026-09-12 11:09:03', NULL),
(12, 'Kia', 'Picanto', 2020, 7600000.00, 29000, 'Used', 'Hatchback', 'Petrol', 'Automatic', '1000cc', 'Yellow', 'Carefully selected 2020 Kia Picanto with verified specifications and showroom inspection. Contact High Street to arrange a viewing.', 'Sold', 1, '2026-09-01 11:09:03', '2026-09-12 11:09:03', NULL),
(13, 'Lamborghini', 'Aventador', 2026, 250000000.00, 0, 'New', 'Sedan', 'Petrol', 'Automatic', '3000', 'Orange', 'One & Only in the market', 'Sold', 1, '2026-09-13 06:15:59', '2026-09-13 09:30:45', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `vehicle_images`
--

CREATE TABLE `vehicle_images` (
  `image_id` int(11) NOT NULL,
  `vehicle_id` int(11) NOT NULL,
  `url` varchar(500) NOT NULL,
  `public_id` varchar(255) DEFAULT NULL,
  `alt_text` varchar(180) DEFAULT NULL,
  `is_primary` tinyint(1) DEFAULT 0,
  `sort_order` int(11) DEFAULT 0,
  `created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `vehicle_images`
--

INSERT INTO `vehicle_images` (`image_id`, `vehicle_id`, `url`, `public_id`, `alt_text`, `is_primary`, `sort_order`, `created_at`) VALUES
(1, 1, 'https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 1', 1, 0, '2026-09-12 11:09:03'),
(2, 1, 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 2', 0, 1, '2026-09-12 11:09:03'),
(3, 1, 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 3', 0, 2, '2026-09-12 11:09:03'),
(4, 2, 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 1', 1, 0, '2026-09-12 11:09:03'),
(5, 2, 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 2', 0, 1, '2026-09-12 11:09:03'),
(6, 2, 'https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 3', 0, 2, '2026-09-12 11:09:03'),
(7, 3, 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 1', 1, 0, '2026-09-12 11:09:03'),
(8, 3, 'https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 2', 0, 1, '2026-09-12 11:09:03'),
(9, 3, 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 3', 0, 2, '2026-09-12 11:09:03'),
(10, 4, 'https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 1', 1, 0, '2026-09-12 11:09:03'),
(11, 4, 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 2', 0, 1, '2026-09-12 11:09:03'),
(12, 4, 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 3', 0, 2, '2026-09-12 11:09:03'),
(13, 5, 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 1', 1, 0, '2026-09-12 11:09:03'),
(14, 5, 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 2', 0, 1, '2026-09-12 11:09:03'),
(15, 5, 'https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 3', 0, 2, '2026-09-12 11:09:03'),
(16, 6, 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 1', 1, 0, '2026-09-12 11:09:03'),
(17, 6, 'https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 2', 0, 1, '2026-09-12 11:09:03'),
(18, 6, 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 3', 0, 2, '2026-09-12 11:09:03'),
(19, 7, 'https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 1', 1, 0, '2026-09-12 11:09:03'),
(20, 7, 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 2', 0, 1, '2026-09-12 11:09:03'),
(21, 7, 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 3', 0, 2, '2026-09-12 11:09:03'),
(22, 8, 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 1', 1, 0, '2026-09-12 11:09:03'),
(23, 8, 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 2', 0, 1, '2026-09-12 11:09:03'),
(24, 8, 'https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 3', 0, 2, '2026-09-12 11:09:03'),
(25, 9, 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 1', 1, 0, '2026-09-12 11:09:03'),
(26, 9, 'https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 2', 0, 1, '2026-09-12 11:09:03'),
(27, 9, 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 3', 0, 2, '2026-09-12 11:09:03'),
(28, 10, 'https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 1', 1, 0, '2026-09-12 11:09:03'),
(29, 10, 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 2', 0, 1, '2026-09-12 11:09:03'),
(30, 10, 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 3', 0, 2, '2026-09-12 11:09:03'),
(31, 11, 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 1', 1, 0, '2026-09-12 11:09:03'),
(32, 11, 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 2', 0, 1, '2026-09-12 11:09:03'),
(33, 11, 'https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 3', 0, 2, '2026-09-12 11:09:03'),
(34, 12, 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 1', 1, 0, '2026-09-12 11:09:03'),
(35, 12, 'https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 2', 0, 1, '2026-09-12 11:09:03'),
(36, 12, 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1400&q=80', NULL, 'Demonstration vehicle image 3', 0, 2, '2026-09-12 11:09:03'),
(40, 13, '/uploads/2999f138-ace0-466f-bbb0-b09a3970836d.webp', NULL, 'Lamborghini SVJ', 0, 0, '2026-09-13 06:33:58'),
(41, 13, '/uploads/d2bb13cc-dc3a-4ed4-a9a6-47b6ee27bcf3.jfif', NULL, 'Lamborghini SVJ', 0, 1, '2026-09-13 06:34:45');

-- --------------------------------------------------------

--
-- Table structure for table `wishlists`
--

CREATE TABLE `wishlists` (
  `wishlist_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `vehicle_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admin_sessions`
--
ALTER TABLE `admin_sessions`
  ADD PRIMARY KEY (`session_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `company_content`
--
ALTER TABLE `company_content`
  ADD PRIMARY KEY (`content_id`),
  ADD KEY `company_content_section_slug` (`section_slug`);

--
-- Indexes for table `enquiries`
--
ALTER TABLE `enquiries`
  ADD PRIMARY KEY (`enquiry_id`),
  ADD KEY `vehicle_id` (`vehicle_id`),
  ADD KEY `responded_by` (`responded_by`),
  ADD KEY `enquiries_status` (`status`),
  ADD KEY `enquiries_created_at` (`created_at`),
  ADD KEY `enquiries_customer_index` (`customer_id`),
  ADD KEY `enquiries_assigned_to_index` (`assigned_to`),
  ADD KEY `enquiries_assigned_by_index` (`assigned_by`),
  ADD KEY `enquiries_staff_status_index` (`assigned_to`,`status`);

--
-- Indexes for table `enquiry_responses`
--
ALTER TABLE `enquiry_responses`
  ADD PRIMARY KEY (`response_id`),
  ADD KEY `enquiry_id` (`enquiry_id`),
  ADD KEY `admin_id` (`admin_id`);

--
-- Indexes for table `financing_configs`
--
ALTER TABLE `financing_configs`
  ADD PRIMARY KEY (`config_id`),
  ADD KEY `financing_configs_is_active` (`is_active`);

--
-- Indexes for table `sequelizemeta`
--
ALTER TABLE `sequelizemeta`
  ADD PRIMARY KEY (`name`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `staff_permissions`
--
ALTER TABLE `staff_permissions`
  ADD PRIMARY KEY (`permission_id`),
  ADD UNIQUE KEY `staff_permissions_user_unique` (`user_id`);

--
-- Indexes for table `test_drive_bookings`
--
ALTER TABLE `test_drive_bookings`
  ADD PRIMARY KEY (`booking_id`),
  ADD KEY `idx_test_drive_customer` (`customer_id`),
  ADD KEY `idx_test_drive_vehicle` (`vehicle_id`),
  ADD KEY `idx_test_drive_assigned_to` (`assigned_to`),
  ADD KEY `idx_test_drive_status` (`status`),
  ADD KEY `idx_test_drive_preferred_date` (`preferred_date`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `users_email` (`email`);

--
-- Indexes for table `vehicles`
--
ALTER TABLE `vehicles`
  ADD PRIMARY KEY (`vehicle_id`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `vehicles_make` (`make`),
  ADD KEY `vehicles_model` (`model`),
  ADD KEY `vehicles_year` (`year`),
  ADD KEY `vehicles_price` (`price`),
  ADD KEY `vehicles_condition` (`condition`),
  ADD KEY `vehicles_type` (`type`),
  ADD KEY `vehicles_fuel_type` (`fuel_type`),
  ADD KEY `vehicles_status` (`status`);

--
-- Indexes for table `vehicle_images`
--
ALTER TABLE `vehicle_images`
  ADD PRIMARY KEY (`image_id`),
  ADD KEY `vehicle_images_vehicle_id_sort_order` (`vehicle_id`,`sort_order`);

--
-- Indexes for table `wishlists`
--
ALTER TABLE `wishlists`
  ADD PRIMARY KEY (`wishlist_id`),
  ADD UNIQUE KEY `wishlists_customer_vehicle_unique` (`customer_id`,`vehicle_id`),
  ADD KEY `wishlists_customer_index` (`customer_id`),
  ADD KEY `wishlists_vehicle_index` (`vehicle_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `admin_sessions`
--
ALTER TABLE `admin_sessions`
  MODIFY `session_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=72;

--
-- AUTO_INCREMENT for table `company_content`
--
ALTER TABLE `company_content`
  MODIFY `content_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `enquiries`
--
ALTER TABLE `enquiries`
  MODIFY `enquiry_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT for table `enquiry_responses`
--
ALTER TABLE `enquiry_responses`
  MODIFY `response_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `financing_configs`
--
ALTER TABLE `financing_configs`
  MODIFY `config_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `staff_permissions`
--
ALTER TABLE `staff_permissions`
  MODIFY `permission_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `test_drive_bookings`
--
ALTER TABLE `test_drive_bookings`
  MODIFY `booking_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `vehicles`
--
ALTER TABLE `vehicles`
  MODIFY `vehicle_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `vehicle_images`
--
ALTER TABLE `vehicle_images`
  MODIFY `image_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=42;

--
-- AUTO_INCREMENT for table `wishlists`
--
ALTER TABLE `wishlists`
  MODIFY `wishlist_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `admin_sessions`
--
ALTER TABLE `admin_sessions`
  ADD CONSTRAINT `admin_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;

--
-- Constraints for table `enquiries`
--
ALTER TABLE `enquiries`
  ADD CONSTRAINT `enquiries_assigned_by_foreign_idx` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `enquiries_assigned_to_foreign_idx` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `enquiries_customer_id_foreign_idx` FOREIGN KEY (`customer_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `enquiries_ibfk_1` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`vehicle_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `enquiries_ibfk_2` FOREIGN KEY (`responded_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL;

--
-- Constraints for table `enquiry_responses`
--
ALTER TABLE `enquiry_responses`
  ADD CONSTRAINT `enquiry_responses_ibfk_1` FOREIGN KEY (`enquiry_id`) REFERENCES `enquiries` (`enquiry_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `enquiry_responses_ibfk_2` FOREIGN KEY (`admin_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `staff_permissions`
--
ALTER TABLE `staff_permissions`
  ADD CONSTRAINT `staff_permissions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `test_drive_bookings`
--
ALTER TABLE `test_drive_bookings`
  ADD CONSTRAINT `test_drive_bookings_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `users` (`user_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `test_drive_bookings_ibfk_2` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`vehicle_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `test_drive_bookings_ibfk_3` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `vehicles`
--
ALTER TABLE `vehicles`
  ADD CONSTRAINT `vehicles_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL;

--
-- Constraints for table `vehicle_images`
--
ALTER TABLE `vehicle_images`
  ADD CONSTRAINT `vehicle_images_ibfk_1` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`vehicle_id`) ON DELETE CASCADE;

--
-- Constraints for table `wishlists`
--
ALTER TABLE `wishlists`
  ADD CONSTRAINT `wishlists_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `wishlists_ibfk_2` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`vehicle_id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
