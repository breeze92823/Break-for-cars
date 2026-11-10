# Break for Cars: Bloxity metadata

```yaml
gameSlug: break-for-cars
clientDir: .
buildCommand: npm run build
distDir: dist
canDie: false        # falling off the island just respawns the player at their garage
hasScore: true       # boards: cash, income, playtime (config.js LEADERBOARDS; reported by the game server)
roomSize: 6          # backend ROOM_MAX_CLIENTS: one garage per player
notApplicable:
  gems: In-game purchases are not part of this game yet.
  deathScreen: The player cannot die (canDie false).
```

Where each Bloxity feature lives:

| Feature | Code |
| --- | --- |
| SDK script tag, before the game's code | `index.html` |
| init, loading, settings, auth, avatar, player events, chat, ads, leaderboards, matchmaker helpers | `src/bloxity.js` |
| Emote playback (ours and relayed) | `src/avatar/emotes.js`, `src/avatar/animator.js` |
| Chat bubbles | `src/bubble.js`, `src/main.js`, `src/remotePlayers.js` |
| Matchmaker connect, `?roomId=`, `updateRoom`, join toasts | `src/net.js` |
| Ad breaks (pause + mute), screen ads, rewarded ad (Spin Wheel) | `src/main.js`, `src/game/spin.js` |
| Token verify, room reporter, hosted leaderboards, ad reward verify | `../Break-for-cars-backend/src` |
