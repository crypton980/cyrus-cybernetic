import fs from "node:fs";
import OpenAI, { toFile } from "openai";
import { Buffer } from "node:buffer";
export const openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});
/**
 * Generate an image and return as Buffer.
 * Uses gpt-image-1 model via Replit AI Integrations.
 */
export async function generateImageBuffer(prompt, size = "1024x1024") {
    const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        size,
    });
    const imageData = response.data?.[0];
    const base64 = imageData?.b64_json ?? "";
    return Buffer.from(base64, "base64");
}
/**
 * Edit/combine multiple images into a composite.
 * Uses gpt-image-1 model via Replit AI Integrations.
 */
export async function editImages(imageFiles, prompt, outputPath) {
    const images = await Promise.all(imageFiles.map((file) => toFile(fs.createReadStream(file), file, {
        type: "image/png",
    })));
    const response = await openai.images.edit({
        model: "gpt-image-1",
        image: images,
        prompt,
    });
    const imageResult = response.data?.[0];
    const imageBase64 = imageResult?.b64_json ?? "";
    const imageBytes = Buffer.from(imageBase64, "base64");
    if (outputPath) {
        fs.writeFileSync(outputPath, imageBytes);
    }
    return imageBytes;
}
