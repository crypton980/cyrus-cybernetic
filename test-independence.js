#!/usr/bin/env node

/**
 * CYRUS OpenAI Independence Test
 * Verifies that CYRUS can operate without OpenAI dependencies
 */

import { localLLM } from './server/ai/local-llm-client.ts';
import { localVision } from './server/scan/local-vision-client.ts';
import { localImageGen } from './server/replit_integrations/image/local-image-client.ts';

async function testIndependence() {
  console.log('🧪 Testing CYRUS OpenAI Independence...\n');

  // Test 1: Local LLM
  console.log('🤖 Testing Local LLM...');
  try {
    const isAvailable = await localLLM.isAvailable();
    if (isAvailable) {
      const response = await localLLM.chat([
        { role: 'user', content: 'Hello, I am testing CYRUS independence from OpenAI.' }
      ]);
      console.log('✅ Local LLM working:', response.substring(0, 100) + '...');
    } else {
      console.log('⚠️  Local LLM not available (Ollama not running)');
      console.log('   Start Ollama: ollama serve');
    }
  } catch (error) {
    console.log('❌ Local LLM failed:', error.message);
  }

  // Test 2: Local Vision
  console.log('\n👁️  Testing Local Vision...');
  try {
    // Create a simple test image buffer (1x1 pixel)
    const testBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    const visionResult = await localVision.ocr(testBuffer);
    console.log('✅ Local Vision working:', visionResult.ocrText || 'No text detected');
  } catch (error) {
    console.log('❌ Local Vision failed:', error.message);
  }

  // Test 3: Local Image Generation
  console.log('\n🎨 Testing Local Image Generation...');
  try {
    const isAvailable = await localImageGen.isAvailable();
    if (isAvailable) {
      console.log('✅ Local Image Generation available');
    } else {
      console.log('⚠️  Local Image Generation not available (missing dependencies)');
    }
  } catch (error) {
    console.log('❌ Local Image Generation failed:', error.message);
  }

  // Test 4: Environment Variables
  console.log('\n⚙️  Checking Environment Configuration...');
  const localLLMEnabled = process.env.USE_LOCAL_LLM !== 'false';
  const localVisionEnabled = process.env.USE_LOCAL_VISION !== 'false';
  const localImageGenEnabled = process.env.USE_LOCAL_IMAGE_GEN !== 'false';

  console.log(`Local LLM: ${localLLMEnabled ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`Local Vision: ${localVisionEnabled ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`Local Image Gen: ${localImageGenEnabled ? '✅ Enabled' : '❌ Disabled'}`);

  const openAIKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  console.log(`OpenAI Key: ${openAIKey ? '⚠️  Configured (fallback available)' : '✅ Not configured (fully independent)'}`);

  console.log('\n🎉 OpenAI Independence Test Complete!');
  console.log('\nTo achieve full independence:');
  console.log('1. Install Ollama: ./setup-ollama.sh');
  console.log('2. Start Ollama: ollama serve');
  console.log('3. Install Python packages: pip install transformers torch opencv-python pytesseract diffusers');
  console.log('4. Set environment variables: USE_LOCAL_LLM=true, USE_LOCAL_VISION=true, USE_LOCAL_IMAGE_GEN=true');
}

// Run the test
testIndependence().catch(console.error);