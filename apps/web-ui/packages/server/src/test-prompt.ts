/**
 * Quick test to verify system prompt generation
 */

import { PromptManager } from './services/managers/promptManager.js';

const promptManager = new PromptManager();
const systemPrompt = promptManager.getSystemPrompt();

console.log('=== SYSTEM PROMPT ===');
console.log(systemPrompt);
console.log('\n=== END SYSTEM PROMPT ===');

// Check if Web Search is mentioned
if (systemPrompt.includes('WEB SEARCH')) {
  console.log('\n✅ Web Search capabilities ARE in the system prompt');
} else {
  console.log('\n❌ Web Search capabilities NOT FOUND in system prompt!');
}

// Check for web_search tool mention
if (systemPrompt.includes('web_search')) {
  console.log('✅ web_search tool IS mentioned');
} else {
  console.log('❌ web_search tool NOT mentioned!');
}
