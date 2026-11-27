import { createReadStream } from "node:fs";

/**
 * @param {any} openAiClient
 * @param {string} localPath
 */
export async function transcribeAudioFile(openAiClient, localPath) {
  if (!openAiClient) {
    return "";
  }

  const file = createReadStream(localPath);
  try {
    const transcription = await openAiClient.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });
    return typeof transcription?.text === "string" ? transcription.text.trim() : "";
  } finally {
    file.destroy();
  }
}
