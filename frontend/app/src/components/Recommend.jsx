import React, { useState } from "react";

function Recommend() {
  const [steamId, setSteamId] = useState("");
  const [recommendations, setRecommendations] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(
        `http://localhost:8080/recommend?steamId=${steamId}`
      );

      const data = await response.json();
      setRecommendations(data.recommendations || []);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <div>
      <h2>Steam Game Recommender</h2>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Enter Steam ID"
          value={steamId}
          onChange={(e) => setSteamId(e.target.value)}
        />
        <button type="submit">Get Recommendations</button>
      </form>

      <ul>
        {recommendations.map((game, index) => (
          <li key={index}>{game}</li>
        ))}
      </ul>
    </div>
  );
}

export default Recommend;
