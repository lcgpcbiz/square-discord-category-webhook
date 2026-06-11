import { postDiscord } from './discord.js';

await postDiscord({
  content: 'Square → Discord webhook test is working. Future watched-category updates can post here.'
});
console.log('Sent Discord test message.');
