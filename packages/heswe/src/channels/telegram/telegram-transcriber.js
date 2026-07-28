import fsSync from "node:fs";

/**
 * @param {any} openAiClient
 * @param {string} localPath
 */
export async function transcribeAudioFile(openAiClient, localPath) {
  if (!openAiClient) {
    return "";
  }

  const transcription = await openAiClient.audio.transcriptions.create({
    file: fsSync.createReadStream(localPath),
    model: "whisper-1",
  });

  if (!transcription || typeof transcription.text !== "string") {
    return "";
  }

  return transcription.text.trim();
}
