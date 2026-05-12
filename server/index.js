import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // More permissive for local dev
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// REAL-TIME MATCH TRACKER (GT vs SRH - LIVE)
const liveMatchData = {
  matchName: "GT vs SRH (IPL 2026)",
  venue: "Narendra Modi Stadium, Ahmedabad",
  score: "158/4 (19.0)",
  lastOver: "19th Over: Sakib Hussain restricted Sudharsan.",
};

// Live Scenarios based on real match state
const scenarios = [
  {
    id: 101,
    situation: `DEATH OVERS - ${liveMatchData.matchName}. GT: ${liveMatchData.score}. Washington Sundar on strike. Last over starts now!`,
    question: "Final over strategy: Who should bowl the crucial 20th over for SRH to keep GT under 175?",
    options: ["Pat Cummins (Experience)", "T Natarajan (Yorkers)", "Sakib Hussain (Momentum)"],
    actualCaptainChoice: "Pat Cummins (Experience)",
    meritScore: {
      "Pat Cummins (Experience)": 95,
      "T Natarajan (Yorkers)": 80,
      "Sakib Hussain (Momentum)": 70
    }
  },
  {
    id: 102,
    situation: `INNINGS BREAK - Gujarat Titans finish at 172/6. SRH need 173 to win. Pitch is slowing down.`,
    question: "Opening pair strategy: How should Abhishek Sharma approach the first 6 overs?",
    options: ["Aggressive (Powerplay push)", "Stable (Protect wickets)", "Dynamic (Strike rotation)"],
    actualCaptainChoice: "Aggressive (Powerplay push)",
    meritScore: {
      "Aggressive (Powerplay push)": 90,
      "Stable (Protect wickets)": 60,
      "Dynamic (Strike rotation)": 85
    }
  }
];

// In-memory Database (Simulating PostgreSQL for portability)
const users = [
  { id: '1', name: 'Virat_Fan18', score: 14500, rank: 1, change: '+240' },
  { id: '2', name: 'Mahi_Magic', score: 14200, rank: 2, change: '+180' },
  { id: '3', name: 'SkyHigh_77', score: 13800, rank: 3, change: '+310' },
];

let currentScenarioIndex = 0;

// Broadcast new scenario every 30 seconds
setInterval(() => {
  currentScenarioIndex = (currentScenarioIndex + 1) % scenarios.length;
  io.emit('new_scenario', scenarios[currentScenarioIndex]);
  console.log(`Broadcasting scenario: ${scenarios[currentScenarioIndex].id}`);
}, 30000);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Send current scenario on connect
  socket.emit('new_scenario', scenarios[currentScenarioIndex]);

  socket.on('submit_decision', (data) => {
    const scenario = scenarios.find(s => s.id === data.scenarioId);
    if (scenario) {
      const score = scenario.meritScore[data.decision] || 0;
      const actual = scenario.actualCaptainChoice;
      
      // Update local "Session" user (In a real app, this would be DB)
      const feedback = score > 80 ? "Excellent Tactical IQ!" : "Risky move. The actual captain chose: " + actual;
      
      socket.emit('decision_result', {
        score,
        actualChoice: actual,
        feedback
      });

      // Update leaderboard (Simplified demo logic)
      const userIdx = users.findIndex(u => u.name === 'You'); // Current user stub
      if (userIdx === -1) {
        users.push({ id: socket.id, name: 'You', score: score, rank: users.length + 1, change: '+'+score });
      } else {
        users[userIdx].score += score;
      }
      
      // Re-sort and broadcast leaderboard
      users.sort((a, b) => b.score - a.score);
      users.forEach((u, i) => u.rank = i + 1);
      io.emit('leaderboard_update', users);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
