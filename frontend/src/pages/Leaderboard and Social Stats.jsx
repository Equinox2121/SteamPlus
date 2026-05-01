const BACKEND_URL = "http://localhost:5000";
 
const fetchSteamId = async () => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/user`);
    const data = await res.json();
    return data.steamId;
  } catch (err) {
    console.error("Failed to get SteamID:", err);
    return null;
  }
};

const API_KEY = "CAA4749CAF9399C2F00E5B805F46349B";

const fetchSocialStats = async (steamId) => {
  try {
    const gamesRes = await fetch(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${API_KEY}&steamid=${steamId}`
    );
    const gamesData = await gamesRes.json();

    const friendsRes = await fetch(
      `https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=${API_KEY}&steamid=${steamId}`
    );
    const friendsData = await friendsRes.json();

    const friends = friendsData.friendslist?.friends || [];

    let onlineFriends = 0;

    if (friends.length > 0) {
      const ids = friends.map((f) => f.steamid).join(",");

      const summaryRes = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${API_KEY}&steamids=${ids}`
      );
      const summaryData = await summaryRes.json();

      onlineFriends = summaryData.response.players.filter(
        (p) => p.personastate !== 0
      ).length;
    }

    return {
      friends: friends.length,
      onlineFriends,
      gamesOwned: gamesData.response?.game_count || 0,
    };
  } catch (err) {
    console.error("Steam API Error:", err);
    return null;
  }
};

const fetchLeaderboard = async () => {
  return [
    { rank: 1, username: "TopPlayer", score: 9999 },
    { rank: 2, username: "SecondBest", score: 8500 },
    { rank: 3, username: "ThirdPlace", score: 7200 },
  ];
};


const Leaderboard = () => {
export default SteamDashboard;
